// TODO: 注释写在页面项目里，要不要移过来？
export interface BlogServerOptions {
	outputDir: string;
	assetsDir: string;

	blog: AppOptions;
	server: ServerOptions;
}

export interface AppOptions {
	host: string;
	serverAddress: string;
	imageRoot: string;
	serverCert: string | true;
}

export interface ServerOptions {
	hostname?: string;
	http?: HttpServerOptions;
	https?: HttpsServerOptions;
}

export interface HttpServerOptions {
	port?: number;
	redirect?: number | true;
}

export interface HttpsServerOptions extends HttpServerOptions {
	keyFile: string;
	certFile: string;
	sni?: SNIProperties[];
}

export interface SNIProperties {
	cert: string;
	key: string;
	hostname: string;
}
