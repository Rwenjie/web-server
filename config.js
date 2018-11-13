module.exports = {
	logLevel: "info",
	fileLog: false,

	dev: {
		client: "D:\\Project\\Blog\\WebContent\\build\\webpack\\client.config.js",
		server: "D:\\Project\\Blog\\WebContent\\build\\webpack\\server.config.js",
	},

	port: 80,
	content: "D:\\Project\\Blog\\WebContent\\dist",
	cacheMaxAge: 31536000000,
	image: {
		root: "G:/备份/blog.kaciras.net/image",
		maxSize: 52428800,
	},
	cors: {
		maxAge: 864000,
		exposeHeaders: ["Location"],
		allowHeaders: ["X-CSRF-Token", "X-Requested-With", "Content-Type"],
		credentials: true,
	},
	ssr: {
		cache: false,
	},
	httpsPort: 443,
	tls: true,
	redirectHttp: false,

	apiServer: "https://localhost:2375",
	certificate: "D:/Coding/Utils/dev.pem",
	privatekey: "D:/Coding/Utils/dev.pvk",
};
