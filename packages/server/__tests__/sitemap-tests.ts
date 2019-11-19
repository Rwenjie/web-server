import axios from "axios";
import Koa from "koa";
import supertest from "supertest";
import { createSitemapMiddleware } from "../lib/sitemap";
import { readFixtureText } from "./test-util";
import Mock = jest.Mock;

jest.mock("axios");

const SITEMAP = readFixtureText("sitemap.xml");
const SITEMAP_BAIDU = readFixtureText("sitemap-baidu.xml");

const DATA = {
	items: [
		{ id: 0, update: 1572446089218, urlTitle: "test-0" },
		{ id: 123, update: 1572446089218, urlTitle: "test-1" },
	],
};

const app = new Koa();
app.use(createSitemapMiddleware("123.45.67.89"));
const callback = app.callback();

(axios.get as Mock).mockResolvedValue({ status: 200, data: DATA });

it("should response sitemap xml", () => {
	return supertest(callback)
		.get("/sitemap.xml")
		.expect(200)
		.expect((res) => expect(res.text).toBe(SITEMAP));
});

it("should output short date for Baidu", () => {
	return supertest(callback)
		.get("/sitemap.xml")
		.query({ type: "baidu" })
		.expect(200)
		.expect((res) => expect(res.text).toBe(SITEMAP_BAIDU));
});

it("should recognize Baidu spider by User-Agent", async () => {
	function _test(userAgent: string) {
		return supertest(callback)
			.get("/sitemap.xml")
			.set("User-Agent", userAgent)
			.expect(200)
			.expect((res) => expect(res.text).toBe(SITEMAP_BAIDU));
	}

	await _test("Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)");

	await _test("Mozilla/5.0 (Linux;u;Android 4.2.2;zh-cn;) AppleWebKit/534.46 (KHTML,like Gecko) " +
		"Version/5.1 Mobile Safari/10600.6.3 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)");
});

it("should return 503 on error", () => {
	(axios.get as Mock).mockRejectedValue(new Error());
	return supertest(callback).get("/sitemap.xml").expect(503);
});
