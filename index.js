var express = require('express')
var http = require('http')
var path = require('path')
var socketio = require('socket.io')
var app = express()
var server = http.Server(app)
var io = socketio(server)
app.set('port',5000)
app.use('/static', express.static(path.join(__dirname, 'static')))
app.get('/', function(request, response) {
    response.sendFile(path.join(__dirname, 'index.html'))
})
server.listen(5000, function() {
    console.log('Starting server on port 5000')
})

io.on('connection', function(socket) {

})


