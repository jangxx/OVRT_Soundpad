window.GLOBAL_API_READY = false;

window.APIInit = function() {
	window.GLOBAL_API_READY = true;

	const event = new Event("api-ready");
	this.dispatchEvent(event);
};

window.DevicePositionUpdate = function(deviceId, deviceInfo) {
	const event = new CustomEvent("device-position", { detail: {
		deviceId,
		deviceInfo: JSON.parse(deviceInfo),
	}});

	this.dispatchEvent(event);
}

window.OverlayTouched = function(deviceId) {
	const event = new CustomEvent("overlay-touched", { detail: {
		deviceId,
	}});

	this.dispatchEvent(event);
}

window.globalCallbackCounter = 0;
window.globalCallbacks = {};

window.callGlobalCallback = function(...args) {
	// console.log(args);

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

class OVRTKOverlay {
	constructor(uid) {
		this._uid = uid;
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

	sendMessage(msg) {
		window.SendMessage(`${this._uid}`, msg);
	}

	getTransform() {
		return new Promise((resolve) => {
			const id = window.registerGlobalCallback(this, result => {
				return resolve(JSON.parse(result[0]));
			});

			console.log("spawn overlay");
			window.GetOverlayTransform(`${this._uid}`, "callGlobalCallback", id);
		});
	}
}

class OVRTKAPi {
	constructor() {
		this._started = false;
		this._events = {};

		window.addEventListener("overlay-touched", evt => this._emit("overlay-touched", evt));
	}

	_emit(event, data) {
		if (!(event in this._events)) return;

		for (let listener of this._events[event]) {
			listener.apply(this, data);
		}
	}

	on(event, listener) {
		if (!(event in this._events)) {
			this._events[event] = [];
		}

		this._events[event].push(listener);
	}

	start() {
		this._started = true;

		// window.SendHandCollisions(true);
	}

	spawnOverlay(transformInfo) {
		return new Promise((resolve) => {
			const id = window.registerGlobalCallback(this, result => {
				const overlay = new OVRTKOverlay(result[0]);
				return resolve(overlay);
			});

			console.log("spawn overlay");
			window.SpawnOverlay(JSON.stringify(transformInfo), "callGlobalCallback", id);
		});
	}
}

