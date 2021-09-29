/**
 * Returns an object describing the capabilites that were introduced with each version of the bridge so that we can show/hide features depending on them
 */
function get_capabilities(version) {
	const capabilities = {
		show_github_url: false,
	};

	if (version == undefined) {
		return capabilities;
	}

	switch (true) {
		case (version.major == 1 && version.minor >= 1): // introduced in v1.1.0
			capabilities.show_github_url = true;
	}

	return capabilities;
}

module.exports = { get_capabilities };