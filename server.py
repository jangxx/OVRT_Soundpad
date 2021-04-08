from sanic import Sanic

app = Sanic("ovrtk_sp")

app.static("/", "./webinterface/index.html")
app.static("/", "./webinterface")