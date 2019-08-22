/*
 * 一些乱七八糟的小中间件，懒得分开了
 */
import { Middleware } from "koa";
import koaSend from "koa-send";
import { getLogger } from "log4js";


const logger = getLogger();

/**
 * 前端页面是否注册 ServiceWorker 的检查点，该URI返回200状态码时表示注册，否则应当注销。
 *
 * @param register 是否注册 ServiceWorker
 */
export function serviceWorkerToggle(register: boolean): Middleware {
	return (ctx, next) => {
		if (ctx.path !== "/sw-check") {
			return next();
		}
		ctx.status = register ? 200 : 205;
		ctx.flushHeaders();
	};
}

/**
 * 能够发送一个位于网站内容目录下的静态文件。
 *
 * @param path_ 资源路径，是URL中的path部分，以/开头
 * @param root 文件所在的目录
 * @return 中间件函数
 */
export function staticFile(path_: string, root: string): Middleware {
	return (ctx, next) => {
		if (ctx.path !== path_) {
			return next();
		}
		if (ctx.method !== "GET") {
			return ctx.status = 405;
		}
		return koaSend(ctx, path_, { root });
	};
}

/**
 * 拦截文件，path匹配到任一模式串的请求将返回404。
 *
 * @param patterns 匹配被拦截文件路径的模式串
 * @return Koa 的中间件函数
 */
export function intercept(patterns: RegExp | RegExp[]): Middleware {

	const combined = Array.isArray(patterns)
		? new RegExp(patterns.map((p) => `(?:${p.source})`).join("|"))
		: patterns;

	return (ctx, next) => {
		if (!combined.test(ctx.path)) {
			return next();
		}
		ctx.status = 404;
		logger.debug(`客户端请求了被拦截的文件：${ctx.url}`);
	};
}
