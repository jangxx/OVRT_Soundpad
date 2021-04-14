from sanic import Sanic, response

app = Sanic("ovrtk_sp")

@app.route("/api/identify")
async def identify(request):
	return response.text("ok")

@app.route("/api/soundlist")
async def get_soundlist(request):
	return response.json({ "soundlist": app.ctx.sp_manager.getSoundList() })

app.static("/", "./webinterface/index.html")
app.static("/", "./webinterface")