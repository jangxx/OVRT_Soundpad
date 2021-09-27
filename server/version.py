import sys
import json
import os

if not getattr(sys, "frozen", False):
	script_dir = os.path.dirname(os.path.realpath(__file__))
	version_file_path = os.path.join(script_dir, "../bridge_version.json")
else:
	version_file_path = "./bridge_version.json"

with open(version_file_path, "r") as version_file:
	BRIDGE_VERSION = json.load(version_file)