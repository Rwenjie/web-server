module.exports = {
	apps: [{
		name: "blog",
		script: "index.js",

		instances: 1,
		autorestart: true,
		watch: false,
		max_memory_restart: "80M",
	}],
};
