import cors, { Options as CorsOptions } from "@koa/cors";
import compress from "koa-compress";
import conditional from "koa-conditional-get";
import etag from "koa-etag";
import serve from "koa-static";
import { createImageMiddleware, ImageMiddlewareOptions } from "./image-store";
import { CliServerPligun } from "./index";
import { intercept, serviceWorkerToggle } from "./middlewares";
import ServerAPI from "./ServerAPI";
import { createSitemapMiddleware } from "./sitemap";
import multer = require("koa-multer");


export interface AppOptions extends ImageMiddlewareOptions {
	cors?: CorsOptions;
	serverAddress: string;
	staticRoot: string;
}

export default class BlogPlugin implements CliServerPligun {

	private readonly options: AppOptions;

	constructor (options: AppOptions) {
		this.options = options;
	}

	configureCliServer (api: ServerAPI) {
		const { options } = this;

		const uploader = multer({ limits: { fileSize: 16 * 1024 * 1024 } });
		api.useBeforeAll(uploader.single("file"));
		api.useBeforeAll(conditional());
		api.useBeforeAll(cors(options.cors));

		api.useBeforeFilter(serviceWorkerToggle(true));
		api.useBeforeFilter(createImageMiddleware(options)); // 图片太大不计算etag

		api.useFilter(intercept([
			"/index.template.html",
			"/vue-ssr-client-manifest.json",
			"/vue-ssr-server-bundle.json",
		]));
		api.useFilter(compress({ threshold: 2048 }));
		api.useFilter(etag());

		api.useResource(serve(options.staticRoot, {
			index: false,
			maxage: 30 * 86400 * 1000,
		}));
		api.useResource(createSitemapMiddleware(options.serverAddress));
	}
}
