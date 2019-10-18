import Axios, { AxiosRequestConfig } from "axios";
import http2, { Http2ServerRequest, Http2ServerResponse } from "http2";
import { AddressInfo, Server } from "net";
import { adaptAxiosHttp2, configureForProxy, CSRF_HEADER_NAME, CSRF_PARAMETER_NAME } from "../lib/axios-helper";
import fs from "fs-extra";
import path from "path";
import Koa from "koa";
import supertest from "supertest";


function helloHandler(req: Http2ServerRequest, res: Http2ServerResponse) {
	res.writeHead(200, { "Content-Type": "text/plain" }).end("Hello");
}

describe("h2c", () => {
	let url: string;
	let server: Server;

	// 创建一个仅支持HTTP2的服务器来测试
	beforeAll((done) => {
		server = http2.createServer(helloHandler);
		server.listen(0, () => {
			done();
			url = "http://localhost:" + (server.address() as AddressInfo).port;
		});
	});
	afterAll((done) => server.close(done));

	it("should fail without adapt", () => {
		const axios = Axios.create();
		return expect(axios.get(url)).rejects.toBeTruthy();
	});

	it("should success with adapt", async () => {
		const axios = Axios.create();
		adaptAxiosHttp2(axios);

		const response = await axios.get(url);
		expect(response.data).toBe("Hello");
	});
});

describe("certificate verification", () => {
	let url: string;
	let server: Server;

	function loadResource(name: string) {
		return fs.readFileSync(path.join(__dirname, "resources", name));
	}

	beforeAll((done) => {
		server = http2.createSecureServer({
			cert: loadResource("localhost.pem"),
			key: loadResource("localhost.pvk"),
		});
		server.listen(0, () => {
			done();
			url = "http://localhost:" + (server.address() as AddressInfo).port;
		});
		server.on("request", helloHandler);
	});

	afterAll((done) => server.close(done));

	// TODO: 自签证书的错误如何捕获？
	// it("should reject self signed certificate", () => {
	// 	const axios = Axios.create();
	// 	adaptAxiosHttp2(axios, true);
	//
	// 	return expect(axios.get(url)).rejects.toBeTruthy();
	// });

	it("should success with trust", async () => {
		const axios = Axios.create();
		adaptAxiosHttp2(axios, true, { ca: loadResource("localhost.pem") });

		const res = await axios.get(url);
		expect(res.data).toBe("Hello");
	});
});

describe("configureForProxy", () => {
	let config: AxiosRequestConfig = {};
	const app = new Koa();
	const server = app.callback();

	app.use((ctx) => {
		config = {};
		configureForProxy(ctx, config);
	});

	it("should set forwarded headers", async () => {
		await supertest(server).get("/");

		// 检查不要添加多余的头部
		expect(Object.keys(config.headers)).toHaveLength(2);

		expect(config.headers["X-Forwarded-For"]).toBe("::ffff:127.0.0.1");
		expect(config.headers["User-Agent"]).toMatch("superagent");
	});

	it("should add principal info", async () => {
		await supertest(server).get("/")
			.query({ [CSRF_PARAMETER_NAME]: "csrf_parameter" })
			.set("Cookie", ["test_cookie"])
			.set(CSRF_HEADER_NAME, "csrf_header");

		expect(config.headers[CSRF_HEADER_NAME]).toBe("csrf_header");
		expect(config.headers.Cookie).toBe("test_cookie");
		expect(config.params[CSRF_PARAMETER_NAME]).toBe("csrf_parameter");
	});
});

describe("CachedFetcher", () => {

	it("should ", () => {
		
	});
});
