/**
 * MIT LICENSE
 * 
 * Copyright 2021 Jan Scheiper, Curtis English
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, 
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

window.GLOBAL_API_READY = false;

window.APIInit = function() {
	window.GLOBAL_API_READY = true;

	const event = new Event("api-ready");
	setTimeout(() => { // can't execute the event code in the same context apparently
		this.dispatchEvent(event);
	}, 0);
	
};

window.DevicePositionUpdate = function(deviceId, deviceInfo) {
	const event = new CustomEvent("device-position", { detail: {
		deviceId,
		deviceInfo: JSON.parse(deviceInfo),
	}});

	this.dispatchEvent(event);
}

window.InteractionStateChanged = function(isInteracting) {
	const event = new CustomEvent("interacting", { detail: {
		isInteracting,
	}});

	this.dispatchEvent(event);
}

window.OverlayTouched = function(deviceId) {
	const event = new CustomEvent("overlay-touched", { detail: {
		deviceId,
	}});

	this.dispatchEvent(event);
}

window.ReceiveMessage = function(msg) {
	let message = null;
	try {
		message = JSON.parse(msg);
	} catch(e) {
		console.error("Error while parsing JSON:", e);
	}

	const event = new CustomEvent("overlay-message", { detail: {
		message,
	}});

	this.dispatchEvent(event);
}

window.OverlayOpened = function(uid) {
	const event = new CustomEvent("overlay-opened", { detail: {
		uid,
	}});

	this.dispatchEvent(event);
}

window.OverlayClosed = function(uid) {
	const event = new CustomEvent("overlay-closed", { detail: {
		uid,
	}});

	this.dispatchEvent(event);
}

window.OverlayTransformChanged = function(uid, newTransform) {
	const event = new CustomEvent("overlay-changed", { detail: {
		uid,
		transform: JSON.parse(newTransform),
	}});

	this.dispatchEvent(event);
}

window.globalCallbackCounter = 0;
window.globalCallbacks = {};

window.callGlobalCallback = function(...args) {
	const id = args.pop();

	if (!(id in window.globalCallbacks)) return;

	const { scope, fn } = window.globalCallbacks[id];

	fn.apply(scope, [ args ]);

	delete window.globalCallbacks[id];
}

window.registerGlobalCallback = function(scope, fn) {
	let id = `cb${window.globalCallbackCounter++}`;

	window.globalCallbacks[id] = { scope, fn };

	return id;
}

// methods in this class are not proxied since you are not really supposed to instantiate this class directly
// and spawnOverlay is only available once the API is ready
class OVRTOverlay {
	constructor(uid) {
		this._uid = uid;
	}

	get id() {
		return this._uid;
	}

	refresh() {
		window.Refresh(`${this._uid}`);
	}

	close() {
		window.CloseOverlay(`${this._uid}`);
	}

	setContent(type, content) {
		window.SetContents(`${this._uid}`, type, JSON.stringify(content));
	}

	setPosition(x, y, z) {
		window.SetOverlayPosition(`${this._uid}`, x, y, z);
	}

	setRotation(rx, ry, rz) {
		window.SetOverlayRotation(`${this._uid}`, rx, ry, rz);
	}

	getTransform() {
		return new Promise((resolve) => {
			const id = window.registerGlobalCallback(this, result => {
				return resolve(JSON.parse(result[0]));
			});

			window.GetOverlayTransform(`${this._uid}`, "callGlobalCallback", id);
		});
	}
	
	getType() {
		return new Promise((resolve) => {
			const id = window.registerGlobalCallback(this, result => {
				return resolve(result[0]);
			});

			window.GetOverlayType(`${this._uid}`, "callGlobalCallback", id);
		});
	}
	
	getBounds() {
		return new Promise((resolve) => {
			const id = window.registerGlobalCallback(this, result => {
				return resolve(JSON.parse(result[0]));
			});

			window.GetOverlayBounds(`${this._uid}`, "callGlobalCallback", id);
		});
	}
	
	setZoom(zoom) {
		window.SetZoom(`${this._uid}`, zoom);
	}
	
	translateUp(amount) {
		window.TranslateUp(`${this._uid}`, amount);
	}
	
	translateRight(amount) {
		window.TranslateRight(`${this._uid}`, amount);
	}
	
	translateForward(amount) {
		window.TranslateForward(`${this._uid}`, amount);
	}
	
	setSize(size) {
		window.SetOverlaySetting(`${this._uid}`, 0, size);
	}
	
	setOpacity(opacity) {
		window.SetOverlaySetting(`${this._uid}`, 1, opacity);
	}
	
	setCurve(curve) {
		window.SetOverlaySetting(`${this._uid}`, 2, curve);
	}
	
	setFramerate(fps) {
		window.SetOverlaySetting(`${this._uid}`, 3, fps);
	}
	
	setEcoMode(enable) {
		window.SetOverlaySetting(`${this._uid}`, 4, enable);
	}
	
	setLookHiding(enable) {
		window.SetOverlaySetting(`${this._uid}`, 5, enable);
	}
	
	setAttachedDevice(deviceID) {
		window.SetOverlaySetting(`${this._uid}`, 6, deviceID);
	}
	
	setPinned(enable) {
		window.SetOverlaySetting(`${this._uid}`, 7, enable);
	}
	
	setBrowserOptionsEnabled(enable) {
		window.SetOverlaySetting(`${this._uid}`, 8, enable);
	}
	
	setRenderingEnabled(enable) {
		window.SetOverlaySetting(`${this._uid}`, 9, enable);
	}
}

class OVRT {
	/**
	 * 
	 * @param {object} opts Initialization parameters
	 * @param {boolean} opts.function_queue Queue function calls to the API until it becomes ready
	 */
	constructor(opts = {}) {
		this._events = {};

		this._enable_function_queue = ("function_queue" in opts) ? opts.function_queue : false;
		this._function_queue = [];

		window.addEventListener("overlay-touched", evt => this._emit("overlay-touched", evt));
		window.addEventListener("device-position", evt => this._emit("device-position", evt));
		window.addEventListener("interacting", evt => this._emit("interacting", evt));
		window.addEventListener("overlay-message", evt => this._emit("message", evt));
		window.addEventListener("overlay-opened", evt => this._emit("overlay-opened", evt));
		window.addEventListener("overlay-closed", evt => this._emit("overlay-closed", evt));
		window.addEventListener("overlay-changed", evt => this._emit("overlay-changed", evt));

		if (this._enable_function_queue) {
			window.addEventListener("api-ready", () => {
				for (let fn of this._function_queue) {
					// I would have loved to store a direct function reference, but the API functions 
					// don't exist before the API is ready, so we have to resolve them dynamically
					window[fn.name].apply(window, fn.args);
				}
				this._function_queue = [];
			});
		}
	}

	_emit(event, data) {
		if (!(event in this._events)) return;

		for (let listener of this._events[event]) {
			try {
				listener(data.detail);
			} catch(e) {
				console.error("Error in event handler:", e);
			}
		}
	}

	_setupEvent(event, enable=true) {
		switch(event) {
			case "overlay-touched":
				return this._callAPIFunction("SendHandCollisions", [ enable ]);
			case "device-position":
				return this._callAPIFunction("SendDeviceData", [ enable ]);
			case "overlay-changed":
				return this._callAPIFunction("SendOverlayPositions", [ enable ]);
		}
	}

	_callAPIFunction(name, args) {
		if (!window.GLOBAL_API_READY && this._enable_function_queue) {
			this._function_queue.push({ name, args });
			return null;
		} else if (!window.GLOBAL_API_READY) {
			console.error("The API is not ready yet, can't call function", name);
			return null;
		} else {
			return window[name].apply(window, args);
		}
	}

	on(event, listener) {
		if (!(event in this._events)) {
			this._events[event] = [];
		}

		this._setupEvent(event); // enable 
		this._events[event].push(listener);
	}

	setCurrentBrowserTitle(title) {
		this._callAPIFunction("SetBrowserTitle", [ title ]);
	}
	
	setDragThreshold(pixels) {
		this._callAPIFunction("SetDragThreshold", [ pixels ]);
	}
	
	blockMovement(enable) {
		this._callAPIFunction("BlockMovement", [ enable ]);
	}

	spawnOverlay(transformInfo) {
		return new Promise((resolve) => {
			const id = window.registerGlobalCallback(this, result => {
				const overlay = new OVRTOverlay(result[0]);
				return resolve(overlay);
			});

			this._callAPIFunction("SpawnOverlay", [ JSON.stringify(transformInfo), "callGlobalCallback", id ]);
		});
	}
	
	closeOverlay(id) {
		this._callAPIFunction("CloseOverlay", [ `${id}` ]);
	}

	getWindowTitles() {
		return new Promise((resolve) => {
			const id = window.registerGlobalCallback(this, result => {
				// Honestly no idea if this should be parsed? It's a Dictionary in C#.
				return resolve(result[0]);
			});

			this._callAPIFunction("GetWindowTitles", [ "callGlobalCallback", id ]);
		});
	}
	
	getMonitorCount() {
		return new Promise((resolve) => {
			const id = window.registerGlobalCallback(this, result => {
				return resolve(result[0]);
			});

			this._callAPIFunction("GetMonitorCount", [ "callGlobalCallback", id ]);
		});
	}
	
	getFingerCurls() {
		return new Promise((resolve) => {
			const id = window.registerGlobalCallback(this, result => {
				return resolve(JSON.parse(result[0]));
			});

			this._callAPIFunction("GetFingerCurls", [ "callGlobalCallback", id ]);
		});
	}
	
	getFileStringContents(path) {
		return new Promise((resolve) => {
			const id = window.registerGlobalCallback(this, result => {
				return resolve(result[0]);
			});

			this._callAPIFunction("GetStringFileContents", [ path, "callGlobalCallback", id ]);
		});
	}
	
	getLastModifiedFileInDirectory(path) {
		return new Promise((resolve) => {
			const id = window.registerGlobalCallback(this, result => {
				return resolve(result[0]);
			});

			this._callAPIFunction("GetLastModifiedFileInDirectory", [ path, "callGlobalCallback", id ]);
		});
	}
	
	getSceneApplicationName() {
		return new Promise((resolve) => {
			const id = window.registerGlobalCallback(this, result => {
				return resolve(result[0]);
			});

			this._callAPIFunction("GetSceneApplicationName", ["callGlobalCallback", id ]);
		});
	}
	
	isAppRunningWithTitle(title) {
		return new Promise((resolve) => {
			const id = window.registerGlobalCallback(this, result => {
				return resolve(result[0]);
			});

			this._callAPIFunction("IsAppRunningWithTitle", [ title, "callGlobalCallback", id ]);
		});
	}
	
	sendMessage(uid, msg) {
		this._callAPIFunction("SendMessage", [ `${uid}`, JSON.stringify(msg) ]);
	}
	
	broadcastMessage(msg) {
		this._callAPIFunction("BroadcastMessage", [ msg ]);
	}
	
	closeEntryApp() {
		this._callAPIFunction("CloseEntryApp", []);
	}
	
	setKeyboardFocus(enable) {
		this._callAPIFunction("SetKeyboardFocus", [ enable ]);
	}
	
	sendNotification(title, body) {
		this._callAPIFunction("SendNotification", [ title, body ]);
	}

	getUniqueID() {
		return new Promise((resolve) => {
			const id = window.registerGlobalCallback(this, result => {
				return resolve(result[0]);
			});

			this._callAPIFunction("GetUniqueID", ["callGlobalCallback", id ]);
		});
	}
}

// uncomment this to use the helper as a common.js module
/*
module.exports = {
	OVRT,
	OVRTOverlay,
};
*/