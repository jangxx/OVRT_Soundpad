from sanic import Sanic, response

app = Sanic("ovrtk_sp")

@app.route("/api/identify")
async def identify(request):
	return response.text("ok")

app.static("/", "./webinterface/index.html")
app.static("/", "./webinterface")