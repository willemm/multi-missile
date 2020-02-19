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
        for (const s in shots) { socket.emit('shot', shots[s]) }
        for (const s in bombs) { socket.emit('bomb', bombs[s]) }
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
        if (shot.state == 'boom') {
            intercept(shot)
        }
    })
    socket.on('base', (base) => {
        let b = bases.find(b => b.id == base.id)
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

// Check of dit schot een van de bommen gaat raken
function intercept(shot)
{
    for (const b in bombs) {
        let bomb = bombs[b]
        // Bomb line: (x1,y1,tick) -> (x2,y2,tick+time)
        // Translate: (0,0,0) -> (x2-x1,y2-y1,time)
        // Function: x/dx = y/dy = t/dt
        // So: x = t*dx/dt and y = t*dy/dt
        let dxt = (bomb.targetx-bomb.startx)/bomb.time
        let dyt = (bomb.targety-bomb.starty)/bomb.time
        // Shot (root) cone: point at (xc,yc,t0), radius is sqrt((t-t0)/boomtime)*boomsize
        // Function: (x*x + y*y = (t-t0)*boomsize/bt)
        // Translate-1: ((x-xc)*(x-xc) + (y-yc)*(y-yc)) = (t - bomb.tick)*boomsize*boomsize/boomtime
        // Translate-2: ((x-xc-x1)*(x-xc-x1) + (y-yc-y1)*(y-yc-y1)) = ((t - bomb.tick - shot.tick)*boomsize*boomsize)/boomtime

        // Equations:
        // (t*dxt-xc)^2 + (t*dyt-yc)^2 = (t-tc)*(boomsize/boomtime)
        // dxt^2 * t^2 - 2*xc*dxt * t + xc^2 + dyt^2 * t^2 - 2*yc*dyt * t + yc^2 - (t + tc)*(bs/bt) = 0
        // (dxt^2 + dyt^2) * t^2 + (-2*xc*dxt -2*yc*dyt -(bs/bt)) * t + (xc^2 + yc^2 + tc*bs/bt) = 0
        let bst = (shot.boomsize*shot.boomsize)/shot.boomtime
        let xc = shot.boomx - bomb.startx
        let yc = shot.boomy - bomb.starty
        let fa = dxt*dxt + dyt*dyt
        let fb = -2*xc*dxt -2*yc*dyt -bst
        let fc = xc*xc + yc*yc + (shot.tick-bomb.tick)*bst
        // abc formula (smallest, because first in time)
        // (-b - sqrt(b*b - 4*a*c)) / 2a
        let det = fb*fb - 4*fa*fc
        // console.log('Intersect boom ('+Math.round(shot.boomx)+','+Math.round(shot.boomy)+','+Math.round(shot.tick-bomb.tick)+') and bomb ('+Math.round(bomb.startx)+','+Math.round(bomb.starty)+',0 - '+Math.round(bomb.targetx)+','+Math.round(bomb.targety)+','+Math.round(bomb.time)+') fa = '+fa+' fb = '+Math.round(fb)+' fc = '+Math.round(fc)+' det = '+Math.round(det))
        // console.log('Bomb at boom: ('+Math.round(bomb.startx+(bomb.targetx-bomb.startx) * ((shot.tick-bomb.tick)/bomb.time))+','+Math.round(bomb.starty+(bomb.targety-bomb.starty) * ((shot.tick-bomb.tick)/bomb.time))+')')
        if (det >= 0) {
            let itim = (-fb - Math.sqrt(det))/(2*fa)
            let btim = itim-shot.tick+bomb.tick
            // console.log('itim = '+Math.round(itim))
            // console.log('btim = '+Math.round(btim))
            if ((btim >= 0) && (btim < (shot.boomtime+shot.fadetime)) && (itim < bomb.time)) {
                bomb.targetx = bomb.startx + (bomb.targetx-bomb.startx) * (itim/bomb.time)
                bomb.targety = bomb.starty + (bomb.targety-bomb.starty) * (itim/bomb.time)
                bomb.time = itim
                console.log('Shot intersects bomb at ('+Math.round(bomb.targetx)+','+Math.round(bomb.targety)+','+Math.round(bomb.time)+')')
                io.emit('bomb',bomb)
            }
        }
    }
}

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
        , tick: new Date().getTime() + 1000
        , boomtime: 500
        , boomsize: 20
        , fadetime: 300
        , state: 'run'
        }
        let dx = bomb.targetx-bomb.startx
        let dy = bomb.targety-bomb.starty
        bomb.time = (Math.sqrt(dx*dx+dy*dy) / 600) * (Math.random() * 3000 + 10000)
        bombs[bomb.id] = bomb
        io.emit('bomb',bomb)
        setTimeout(explode, bomb.time+1000, bomb.id)
    }
    setTimeout(attack, Math.random() * 5000+5000)
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
