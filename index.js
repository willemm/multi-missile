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

let bases = [ 0, -600, 600, -300, 300 ].map(x => {
    return { type: 'base'
           , basex: x
           , basey: 800
           , turn:
             { angle: 0
             , prv: 0
             , dir: 0
             , start: 0
             }
           }
})

bases[1].name = 'Alpha'
bases[3].name = 'Bravo'
bases[0].name = 'Charlie'
bases[4].name = 'Delta'
bases[2].name = 'Echo'

let shots = {}
let players = {}

function find_slot(player)
{
    let b = bases.find(b => b.player && (b.player.id == player.id))
    if (!b) { b = bases.find(b => b.player == null) }
    if (!b) {
        console.log('Game is full')
        return {
            type: 'spectator', name: 'Guest'
        }
    }
    b.player = player
    return b
}

let lastplayerid = 0

io.on('connection', function(socket) {
    console.log('Connection from '+socket.conn.remoteAddress)

    socket.on('join', (player) => {
        players[socket.id] = player
        let sl = find_slot(player)
        socket.emit('start', sl)
        for (s in shots) { socket.emit('shot', shots[s]) }
        bases.forEach(b => socket.emit('base', b))
        console.log('Player '+player.id+' joined as '+sl.type+' '+sl.name)
    })
    socket.on('newplayer', () => {
        let playerid = new Date().getTime()
        while (playerid == lastplayerid) { playerid++ }
        lastplayerid = playerid
        socket.emit('newplayer', playerid)
    })

    socket.on('shot', (shot) => {
        io.emit('shot', shot)
        if (shot.state == 'done') {
            delete shots[shot.id]
        } else {
            shots[shot.id] = shot
        }
    })
    socket.on('base', (base) => {
        let b = bases.find(b => b.basex == base.basex)
        if (b) {
            b.turn = base.turn
            io.emit('base', b)
        }
    })
    socket.on('disconnect', () => {
        let socketid = socket.id
        let player = players[socketid]
        if (player) {
            player.disconnected = true
            let base = bases.find(b => (b.player && (b.player.id == player.id)))
            if (base) {
                console.log('Player '+player.id+' disconnected from base '+base.name)
                setTimeout(function() {
                    let player = players[socketid]
                    let base = bases.find(b => (b.player && (b.player.id == player.id)))
                    console.log('Removing player '+player.id+' from base '+base.name)
                    base.player = null
                }, 10 * 1000)
            } else {
                console.log('Player '+player.id+' disconnected')
            }
        } else {
            console.log('Disconnect, no player')
        }
    })
})


