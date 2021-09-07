import sys
import os
from cx_Freeze import setup, Executable

# Dependencies are automatically detected, but it might need fine tuning.
build_exe_options = {
	"packages": [ "pystray" ],
	"excludes": [ ],
	"include_files": [
		("./assets/img/ovrt_sp_icon.png", "ovrt_sp_icon.png"),
	],
	"zip_include_packages": "*",
	"zip_exclude_packages": [ "pystray" ],
	"build_exe": "./dist/bridge",
}

# GUI applications require a different base on Windows (the default is for
# a console application).
base = None
if sys.platform == "win32":
    base = "Win32GUI"

sys.path.append(os.path.join(os.path.dirname(os.path.realpath(__file__)), "server"))

setup(name = "ovrt_sp",
	version = "1.0",
    description = "OVR Toolkit Soundpad Bridge",
    options = { "build_exe": build_exe_options },
    executables = [ Executable("server/main.py", base=base, target_name="ovrt_soundpad_bridge", icon = "./assets/ico/ovrt_sp_icon.ico") ],
)