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

let basenames = [ 'Charlie','Alpha','Echo','Bravo','Delta' ]

let bases = [ 0, -600, 600, -300, 300 ].map((x, i) => {
    return { type: 'base'
           , id: basenames[i]
           , name: basenames[i]
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

let shots = {}
let bombs = {}
let players = {}

function find_slot(player, socketid)
{
    console.log('Finding slot for player '+player.id+' (wants base '+player.base+')')
    let base = bases.find(b => b.player && (b.player.id == player.id))
    if (!base) { base = bases.find(b => (b.player == null) && (b.id == player.base)) }
    if (!base) { base = bases.find(b => b.player == null) }
    if (!base) {
        console.log('Game is full')
        return {
            type: 'spectator', name: 'Guest'
        }
    }
    player.base = base.basex
    base.player = player
    base.socketid = socketid
    base.state = 'connected'
    io.emit('base', base)
    return base
}

let lastplayerid = 0
let bombid = new Date().getTime()

setTimeout(attack, 1000)

io.on('connection', function(socket) {
    console.log('Connection from '+socket.conn.remoteAddress+' id='+socket.id)

    socket.on('join', (player) => {
        if (!player.id) {
            let newid = new Date().getTime()
            if (newid <= lastplayerid) { newid = lastplayerid+1 }
            lastplayerid = newid
            player.id = newid.toString(36)
            console.log('New player, generated id '+player.id)
        }
        players[socket.id] = player
        let sl = find_slot(player, socket.id)
        socket.emit('join', sl)
        for (s in shots) { socket.emit('shot', shots[s]) }
        for (s in bombs) { socket.emit('bomb', bombs[s]) }
        bases.forEach(b => socket.emit('base', b))
        console.log('Player '+player.id+' joined as '+sl.type+' '+sl.name)
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
        console.log('Disconnect socket '+socket.id)
        let socketid = socket.id
        let player = players[socketid]
        if (player) {
            player.disconnected = true
            let base = bases.find(b => (b.player && (b.player.id == player.id)))
            if (base) {
                console.log('Player '+player.id+' disconnected from base '+base.name)
                base.state = 'disconnected'
                io.emit('base',base)
                setTimeout(function() {
                    let player = players[socketid]
                    if (player.disconnected) {
                        let base = bases.find(b => (b.player && (b.player.id == player.id) && (b.socketid == socketid)))
                        if (base) {
                            console.log('Removing player '+player.id+' from base '+base.name)
                            base.player = null
                            io.emit('base', base)
                        }
                    }
                }, 10 * 1000)
            } else {
                console.log('Player '+player.id+' disconnected')
            }
        } else {
            console.log('Disconnect, no player')
        }
    })
})

function attack()
{
    if (bases.find(b => (b.player) && (b.state == 'connected'))) {
        bombid++
        let bomb =
        { id: bombid.toString(36)
        , startx: Math.random() * 1600 - 800
        , starty: 0
        , targetx: Math.random() * 1600 - 800
        , targety: Math.random() * 50 + 800
        , ofa: Math.PI * 2 * Math.random()
        , tick: new Date().getTime()
        , boomtime: 500
        , boomsize: 20
        , fadetime: 300
        , state: 'run'
        }
        let dx = bomb.targetx-bomb.startx
        let dy = bomb.targety-bomb.starty
        bomb.time = (Math.sqrt(dx*dx+dy*dy) / 600) * (Math.random() * 3000 + 8000)
        bombs[bomb.id] = bomb
        io.emit('bomb',bomb)
        setTimeout(explode, bomb.time, bomb.id)
    }
    setTimeout(attack, Math.random() * 3000)
}

function explode(bombid)
{
    let bomb = bombs[bombid]
    if (bomb) {
        bomb.state = 'boom'
        // io.emit('bomb', bomb)
        setTimeout(bombdone, 1000, bombid)
    }
}

function bombdone(bombid)
{
    let bomb = delete bombs[bombid]
    if (bomb) {
        bomb.state = 'done'
        io.emit('bomb', bomb)
    }
}
