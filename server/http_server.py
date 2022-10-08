import webbrowser

from sanic import Sanic, response

from version import BRIDGE_VERSION
from cors import add_cors_headers
from options import setup_options

# setup web server
app = Sanic("ovrt_sp")

@app.route("/api/identify")
async def identify(request):
	return response.json({ "version": BRIDGE_VERSION })

@app.route("/api/soundlist")
async def get_soundlist(request):
	return response.json({ "soundlist": app.ctx.sp_manager.getSoundList() })

@app.route("/api/categories")
async def get_categories(request):
	return response.json({ "categories": app.ctx.sp_manager.getCategories() })

@app.route("/api/open-github", methods=["POST"])
async def open_github_url(request):
	webbrowser.open("https://github.com/jangxx/OVRT_Soundpad/releases/", new=1)
	return response.text("ok")

# Add OPTIONS handlers to any route that is missing it
app.register_listener(setup_options, "before_server_start")

# Fill in CORS headers
app.register_middleware(add_cors_headers, "response")