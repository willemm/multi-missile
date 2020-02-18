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

let bases = [ {x:    0, socket: null}
            , {x: -600, socket: null}
            , {x:  600, socket: null}
            , {x: -300, socket: null}
            , {x:  300, socket: null}
]

let shots = {}

function find_slot(player)
{
    let b = bases.find((b) => b.player && (b.player.id == player.id))
    if (!b) { b = bases.find((b) => b.player == null) }
    if (!b) {
        console.log('Game is full')
        return {
            type: 'spectator'
        }
    }
    b.player = player
    return {
        type: 'base',
        basex: b.x,
        basey: 800,
        angle: 0,
        prvangle: 0,
        shooting: false,
        booming: false
    }
}

let lastplayerid = 0

io.on('connection', function(socket) {
    console.log('Connection from '+socket.conn.remoteAddress)

    socket.on('join', (player) => {
        let sl = find_slot(player)
        socket.emit('start', sl)
        for (s in shots) { socket.emit('shoot', shots[s]) }
        console.log('Player '+player.id+' joined as '+sl.type)
    })
    socket.on('newplayer', () => {
        let playerid = new Date().getTime()
        while (playerid == lastplayerid) { playerid++ }
        lastplayerid = playerid
        socket.emit('newplayer', playerid)
    })

    socket.on('shoot', (shot) => io.emit('shot', shots[shot.id] = shot) )
})


