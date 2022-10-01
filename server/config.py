import json
import os

from appdirs import user_config_dir

def merge_config_dicts(base_config, merge_src):
	result = {}
	for key in merge_src:
		if key in base_config:
			if isinstance(base_config[key], dict) and isinstance(merge_src[key], dict):
				result[key] = merge_config_dicts(base_config[key], merge_src[key])
			elif not isinstance(base_config[key], dict) and not isinstance(merge_src[key], dict):
				result[key] = merge_src[key]
			else: # objects are of different types (one is dict, the other isn't)
				result[key] = base_config[key] # just use the base config in that case
		else:
			result[key] = merge_src[key]

	for key in base_config:
		if not key in result:
			result[key] = base_config[key]

	return result

class Config:
	def __init__(self):
		self._config_path = os.path.join(user_config_dir("OVRT Soundpad", "jangxx"), "config.json")

		self._config = {
			"board": {
				"rows": 3,
				"columns": 4,
				"pages": 1,
			},
			"sounds": {},
			"server": {
				"http_port": 64152,
				"ws_port": 64153
			},
			"overlay": {},
			"soundpad": {
				"autostart_path": None,
				"launch_soundpad_steam": False,
			}
		}

		if os.path.exists(self._config_path):
			with open(self._config_path, "r") as configfile:
				file_config = json.load(configfile)
				self._config = merge_config_dicts(self._config, file_config)

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

	def delete(self, path):
		elem = self._config
		
		for e in path[:-1]:
			elem = elem[e]

		del elem[path[-1]]

		with open(self._config_path, "w+") as configfile:
			json.dump(self._config, configfile)

	def delete_safe(self, path):
		if self.exists(path):
			self.delete(path)
			return True
		else:
			return False

	def exists(self, path):
		cur = self._config

		if not type(path) is list:
			path = [ path ]

		for e in path:
			if not e in cur:
				return False
			else:
				cur = cur[e]

		return True

		