import json, os

from appdirs import user_config_dir

class Config:
	def __init__(self):
		self._config_path = os.path.join(user_config_dir("OVRTK Soundpad", "jangxx"), "config.json")

		self._config = {
			"board": {
				"rows": 3,
				"cols": 4
			},
			"sounds": {},
			"server": {
				"http_port": 64152,
				"ws_port": 64153
			}
		}

		if os.path.exists(self._config_path):
			with open(self._config_path, "r") as configfile:
				self._config = json.load(configfile)

	def get(self, path):
		ret = self._config

		for e in path:
			ret = ret[e]

		return ret

	def set(self, path, value):
		elem = self._config

		for e in path[:-1]:
			elem = elem[e]

		elem[path[-1]] = value

		with open(self._config_path, "w") as configfile:
			json.dump(self._config, configfile)