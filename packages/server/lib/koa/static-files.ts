/**
 * koa-static 和 koa-send 扩展性不能满足本项目的需要，特别是WebP图片选择，所以就自己撸一个。
 * 主要参考了它俩的设计：
 * https://github.com/koajs/send
 * https://github.com/koajs/static
 */
import { basename, extname, join, normalize, parse, resolve, sep } from "path";
import { BaseContext, Middleware, Next } from "koa";
import fs from "fs-extra";
import replaceExt from "replace-ext";
import createError from "http-errors";
import sendFileRange from "./send-range";

interface Options {

	/**
	 * 自定义修改相应的方法，在处理的最后调用，此时文件已确定，相关头部也都设置好了。
	 * 通常用来设置缓存，或者其它自定义的响应头部。
	 *
	 * 【为什么不用中间件来做】
	 * 中间件难以获取执行细节，如被选中的文件，和是否在本中间件返回。
	 *
	 * @param ctx Koa上下文
	 * @param filename 发送的文件的完整路径
	 * @param stats 文件属性
	 */
	customResponse?: (ctx: BaseContext, filename: string, stats: fs.Stats) => void;
}

const UP_PATH_REGEXP = /(?:^|[\\/])\.\.(?:[\\/]|$)/

const NOT_FOUND = ["ENOENT", "ENAMETOOLONG", "ENOTDIR"];

/**
 * Resolve relative path against a root path.
 *
 * 源代码来自：https://github.com/pillarjs/resolve-path
 * 因为原作者没有添加Typescript定义所以就抄过来了，删除了多余的检查。
 */
function resolvePath(root: string, path: string) {
	path = path.substr(parse(path).root.length);

	// containing NULL bytes is malicious
	if (path.indexOf("\0") !== -1) {
		throw createError(400, "Malicious Path");
	}

	// path outside root
	if (UP_PATH_REGEXP.test(normalize("." + sep + path))) {
		throw createError(403);
	}

	// join the relative path
	return normalize(join(resolve(root), path));
}

async function serve(root: string, options: Options, ctx: BaseContext, next: Next) {
	const { method, path } = ctx;
	let file: string;

	switch (method) {
		case "GET":
		case "HEAD":
		case "OPTIONS":
			break;
		default:
			return next();
	}

	try {
		file = decodeURIComponent(path);
	} catch (e) {
		ctx.throw(400, "failed to decode");
	}
	file = resolvePath(root, file);

	let encodingExt = "";

	// TODO: 这些行太长了，而且 pathExists 可以用 stat 来实现，多了一次 IO
	//  怎么能抽象一下？
	if ((ctx.accepts() as string[]).indexOf("image/avif") > -1 && await fs.pathExists(replaceExt(file, ".avif"))) {
		file = replaceExt(file, ".avif");
	} else if ((ctx.accepts() as string[]).indexOf("image/webp") > -1 && await fs.pathExists(replaceExt(file, ".webp"))) {
		file = replaceExt(file, ".webp");
	} else if (ctx.acceptsEncodings("br", "identity") === "br" && (await fs.pathExists(file + ".br"))) {
		file = file + ".br";
		encodingExt = ".br";
		ctx.set("Content-Encoding", "br");
	} else if (ctx.acceptsEncodings("gzip", "identity") === "gzip" && (await fs.pathExists(file + ".gz"))) {
		file = file + ".gz";
		encodingExt = ".gz";
		ctx.set("Content-Encoding", "gzip");
	}

	let stats: fs.Stats;
	try {
		stats = await fs.stat(file);
		if (stats.isDirectory()) {
			return next();
		}
	} catch (err) {
		if (NOT_FOUND.includes(err.code)) {
			return next();
		}
		err.status = 500;
		throw err; // 这个异常不好做测试
	}

	if (encodingExt) {
		ctx.type = extname(basename(file, encodingExt));
	} else if (file.endsWith(".avif")) {
		ctx.type = "image/avif"; // TODO: 等 mime-types 更新后删除
	} else {
		ctx.type = extname(file);
	}

	ctx.set("Last-Modified", stats.mtime.toUTCString());
	sendFileRange(ctx, file, stats.size);

	if (options.customResponse) {
		options.customResponse(ctx, file, stats);
	}
}

export default function createMiddleware(root: string, options: Options = {}): Middleware {
	return (ctx, next) => serve(root, options, ctx, next);
}
