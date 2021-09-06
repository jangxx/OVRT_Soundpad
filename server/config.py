import json, os, pathlib

from appdirs import user_config_dir

class Config:
	def __init__(self):
		self._config_path = os.path.join(user_config_dir("OVRT Soundpad", "jangxx"), "config.json")

		# create config dir if it doesn't exist
		pathlib.Path(user_config_dir("OVRT Soundpad", "jangxx")).mkdir(parents=True, exist_ok=True)

		self._config = {
			"board": {
				"rows": 3,
				"columns": 4
			},
			"sounds": {},
			"server": {
				"http_port": 64152,
				"ws_port": 64153
			},
			"overlay": None,
			"soundpad": {
				"autostart_path": None
			}
		}

		if os.path.exists(self._config_path):
			with open(self._config_path, "r") as configfile:
				file_config = json.load(configfile)
				self._config = { **self._config, **file_config }

	def getExternalSerialized(self):
		"""Return a dict of all settings that are relevant for the frontend"""
		return {
			"board": self.get("board"),
			"sounds": self.get("sounds"),
			"overlay": self.get("overlay"),
		}

	def get(self, path):
		ret = self._config

		if not type(path) is list:
			path = [ path ]

		for e in path:
			ret = ret[e]

		return ret

	def set(self, path, value):
		elem = self._config
		
		for e in path[:-1]:
			elem = elem[e]

		elem[path[-1]] = value

		with open(self._config_path, "w+") as configfile:
			json.dump(self._config, configfile)