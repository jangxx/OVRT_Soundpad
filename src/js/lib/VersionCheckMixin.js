const BRIDGE_VERSION = require("../../../bridge_version.json");
const { get_capabilities } = require("../lib/bridge_capabilities");

module.exports = {
	data: function() {
		return {
			version_checked: false,
			bridge_update_required: false,
			bridge_update_available: false,
			bridge_too_new: false,
			bridge_capabilities: {}
		};
	},
	methods: {
		checkVersion: function(version_obj) {
			if (this.version_checked) return; // don't run this on every single state update
			this.bridge_capabilities = get_capabilities(version_obj);

			this.bridge_update_required = false;
			this.bridge_update_available = false;
			this.bridge_too_new = false;

			let version = version_obj;
			if (version_obj === undefined) { // the very first version didn't send version data yet
				version = { major: 1, minor: 0, patch: 0 };
			}

			if (version.major < BRIDGE_VERSION.major || (version.major == BRIDGE_VERSION.major && version.minor < BRIDGE_VERSION.minor)) {
				this.bridge_update_required = true;
				return false;
			}
			if (version.major > BRIDGE_VERSION.major || (version.major == BRIDGE_VERSION.major && version.minor > BRIDGE_VERSION.minor)) {
				this.bridge_too_new = true;
				return false;
			}

			if (version.major == BRIDGE_VERSION.major && version.minor == BRIDGE_VERSION.minor && version.patch < BRIDGE_VERSION.patch) {
				this.bridge_update_available = true;
			}
			return true;
		},
		open_github_url: async function() {
			await fetch("http://localhost:64152/api/open-github", { method: "POST" });
		}
	}
};