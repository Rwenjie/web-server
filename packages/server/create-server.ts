import fs from "fs-extra";
import http, { IncomingMessage, ServerResponse } from "http";
import http2, { Http2ServerRequest, Http2ServerResponse } from "http2";
import { Server } from "net";
import { createSecureContext, SecureContext } from "tls";
import { ServerOptions, SNIProperties } from "./options";


// app.callback() 的定义，比较长不方便直接写在参数里
type RequestMessage = IncomingMessage | Http2ServerRequest;
type OnRequestHandler = (req: RequestMessage, res: ServerResponse | Http2ServerResponse) => void;
type SNIResolve = (err: Error | null, ctx: SecureContext) => void;


export function createSNICallback(properties: SNIProperties[]) {
	const map: { [k: string]: any } = {};

	// 据测试SecureContext可以重用
	for (const p of properties) {
		map[p.hostname] = createSecureContext({
			key: fs.readFileSync(p.key),
			cert: fs.readFileSync(p.cert),
		});
	}
	return (servername: string, callback: SNIResolve) => callback(null, map[servername]);
}

/**
 * 将 Server.listen 转成异步方法并调用。
 *
 * @param server 服务器
 * @param port 端口
 * @return 原样返回服务器对象
 */
function listenAsync(server: Server, port: number): Promise<Server> {
	return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

/**
 * 创建并启动一个或多个服务器，返回关闭它们的函数。
 *
 * @param requestHandler 处理请求的函数
 * @param options 选项
 * @return 关闭创建的服务器的函数
 */
export async function runServer(requestHandler: OnRequestHandler, options: ServerOptions) {
	const { http: httpConfig, https: httpsConfig } = options;
	const servers: Server[] = [];

	const httpPort = httpConfig && httpConfig.port || 80;
	const httpsPort = httpsConfig && httpsConfig.port || 443;

	/**
	 * 获取请求处理器，如果 redirect 参数不为 undefined 则返回重定向的处理器，否则返回正常的请求处理器。
	 *
	 * @param redirect 重定向设置，数值为重定向端口，true使用默认端口
	 * @param schema 重定向目标的schema
	 * @param toPort 重定向目标的端口
	 */
	function getHandler(redirect: number | true | undefined, schema: string, toPort: number): OnRequestHandler {
		if (!redirect) {
			return requestHandler;
		}
		if (typeof redirect === "number") {
			toPort = redirect;
		}

		const omitPort = (schema === "http" && toPort === 80) || (schema === "https" && toPort === 443);
		const getLocation = omitPort
			? (req: RequestMessage) => `${schema}://${req.headers.host}${req.url}`
			: (req: RequestMessage) => `${schema}://${req.headers.host}:${toPort}${req.url}`;

		return (req, res) => res.writeHead(301, { Location: getLocation(req) }).end();
	}

	if (httpsConfig) {
		const { certFile, keyFile, sni, redirect } = httpsConfig;
		const config = {
			cert: fs.readFileSync(certFile),
			key: fs.readFileSync(keyFile),
			SNICallback: sni && createSNICallback(sni),
			allowHTTP1: true,
		};
		const server = http2.createSecureServer(config, getHandler(redirect, "http", httpPort));
		servers.push(await listenAsync(server, httpsPort));
	}

	if (httpConfig) {
		const server = http.createServer(getHandler(httpConfig.redirect, "https", httpsPort));
		servers.push(await listenAsync(server, httpPort));
	}

	// Keep-Alive 的连接无法关闭，反而会使close方法一直等待，所以close的参数里没有回调
	return () => servers.forEach((s) => s.close());
}
