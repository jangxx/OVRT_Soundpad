import sys
from cx_Freeze import setup, Executable

# Dependencies are automatically detected, but it might need fine tuning.
build_exe_options = {
	"packages": ["pystray"],
	"excludes": ["tkinter"],
	"include_files": [
		("testicon.png", "./testicon.png"),
		("webinterface", "./webinterface"),
	],
	"zip_include_packages": "*",
	"zip_exclude_packages": "pystray",
}

# GUI applications require a different base on Windows (the default is for
# a console application).
base = None
if sys.platform == "win32":
    base = "Win32GUI"

setup(name = "ovrtk_sp",
	version = "1.0",
    description = "OVR Toolkit Soundpad Integration",
    options = { "build_exe": build_exe_options },
    executables = [ Executable("main.py", base=base) ],
)