const { EventEmitter } = require("events");

const METHOD_LIST = [
	"Refresh",
	"CloseOverlay",
	"SetContents",
	"SetOverlayPosition",
	"SetOverlayRotation",
	"GetOverlayTransform",
	"GetOverlayType",
	"GetOverlayBounds",
	"SetZoom",
	"TranslateUp",
	"TranslateRight",
	"TranslateForward",
	"SetOverlaySetting",
	"SetBrowserResolution",
	"SetBrowserTitle",
	"SetDragThreshold",
	"BlockMovement",
	"SpawnOverlay",
	"GetWindowTitles",
	"GetMonitorCount",
	"GetFingerCurls",
	"GetStringFileContents",
	"GetLastModifiedFileInDirectory",
	"GetSceneApplicationName",
	"IsAppRunningWithTitle",
	"SendMessage",
	"BroadcastMessage",
	"CloseEntryApp",
	"SetKeyboardFocus",
	"SendNotification",
	"GetUniqueID",
	"GetWristwatchTransform",

	// ovrt-helper specific:
	"callGlobalCallback",
];

class OVRTMethodProxy extends EventEmitter {
	constructor() {
		super();
		this._api_ready = false;
		this._methods_overwritten = false;
		this._method_refs = {};

		if (window.GLOBAL_API_READY !== undefined) {
			this._api_ready = window.GLOBAL_API_READY;
		}
	}

	_log(message) {
		console.log("Log:", message);
		this.emit("log", message);
	}

	_overwriteMethods() {
		if (this._methods_overwritten) return;

		this._log("Overwriting methods");

		for (let method of METHOD_LIST) {
			const function_ref = window[method];

			if (function_ref !== undefined) {
				this._method_refs[method] = function_ref;
				window[method] = (function(function_name, ...args) {
					try {
						this._log(`${function_name}( ${args.map(a => JSON.stringify(a)).join(", ")} )`);
					} catch(e) {
						this._log(`${function_name}( <serialization failed. no of args: ${args.length}> )`);
					}
					this._method_refs[function_name].apply(window, args);
				}).bind(this, method);
			}
		}

		this._methods_overwritten = true;
	}

	enable() {
		this._log("Enabling the method proxy")
		
		if (window.GLOBAL_API_READY !== undefined) {
			this._api_ready = window.GLOBAL_API_READY;
		}

		if (this._api_ready) {
			return this._overwriteMethods();
		}

		if (window.APIInit !== undefined) {
			window.addEventListener("api-ready", () => {
				this._api_ready = true;
				this._overwriteMethods();
			});
		} else {
			window.APIInit = (function() {
				this._api_ready = true;
				this._overwriteMethods();
			}).bind(this);
		}
	}
};

module.exports = { OVRTMethodProxy };