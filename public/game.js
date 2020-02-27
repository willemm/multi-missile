const socket = io()

setup_socket(socket)

let player = {
    id: null,
    name: null,
    base: null,
    connected: false
}
let gamecfg = {
    drift: 10,
    basesize: 25,
    baseoffset: 20,
    turnspeed: 90 / 5000,
    dashspd: 500,
    gunlen: 20,
    shotstart: 22,
    shotend: 2000,
    dashlen: 10,
    dashpart: 0.2,
    shotspeed: 120 / 1000,
    fadespeed: 1 / 1000,

    boomsize: 80,
    boomtime: 2000,
    boomfadetime: 600
}
let shotid = 1
let shots = {}
let bases = {}
let pressed_up = false
let pressed_down = false
let timedrift = null
let newtimedrift = null

// let tmr
// let ctx

window.onresize = function() {
    let canvas = document.getElementById('canvas')
    canvas.width = canvas.height * canvas.offsetWidth / canvas.offsetHeight
}

function stop_basemove(base, now, turndir)
{
    if (base.turn.dir && (!turndir || (turndir == base.turn.dir))) {
        base.turn.angle = base.turn.prv + base.turn.dir * gamecfg.turnspeed * (now - base.turn.start)
        if (base.turn.angle < -90) base.turn.angle = -90
        if (base.turn.angle >  90) base.turn.angle =  90
        base.turn.prv = base.turn.angle
        base.turn.dir = 0
        socket.emit('base',base)
    }
}

function setup_base(mybase)
{
    document.addEventListener('keydown', function(event) {
        if (!player.connected) return
        let now = new Date().getTime() + timedrift
        let turndir = 1
        let base = bases[mybase]
        switch (event.keyCode) {
            case 37: // LEFT
            case 65: // A
                turndir = -1
                // fallthrough
            case 39: // RIGHT
            case 68: // D
                if (base.turn.dir != turndir) {
                    stop_basemove(base, now, 0)
                    base.turn.start = now
                    base.turn.dir = turndir
                    socket.emit('base',base)
                }
                break
            case 38: // UP
            case 87: // W
                if (!pressed_up) {
                    pressed_up = true
                    shoot(base)
                }
                break
            case 40: // DOWN
            case 83: // S
                if (!pressed_down) {
                    pressed_down = true
                    boom(base)
                }
                break
        }
    })
    document.addEventListener('keyup', function(event) {
        if (!player.connected) return
        let now = new Date().getTime() + timedrift
        let base = bases[mybase]
        let turndir = 1
        switch (event.keyCode) {
            case 37: // LEFT
            case 65: // A
                turndir = -1
                // Fallthrough: Same code
            case 39: // RIGHT
            case 68: // D
                stop_basemove(base, now, turndir)
                break
            case 38: // UP
            case 87: // W
                pressed_up = false
                break
            case 40: // DOWN
            case 83: // S
                pressed_down = false
                break
        }
    })
}

window.onload = function() {
    window.onresize()
    setInterval(timer, 40)
}

function setup_socket(socket)
{
    socket.on('connect', function() {
        player.id = sessionStorage.getItem('playerid')
        player.base = sessionStorage.getItem('playerbase')
        socket.emit('join', player)
        document.body.className = 'connecting'
    })
    socket.on('disconnect', function() {
        player.connected = false
        document.body.className = 'disconnected'
    })
    socket.on('join', function(base) {
        bases[base.id] = base
        player.id = base.player.id
        player.base = base.id
        sessionStorage.setItem('playerid', player.id)
        sessionStorage.setItem('playerbase', player.base)
        player.connected = true

        if (base.type == 'base') {
            setup_base(base.id)
        }
        document.body.className = 'running'
    })
    socket.on('shot', function(shot) {
        if (shot.state == 'done') {
            delete shots[shot.id]
        } else {
            shots[shot.id] = shot
            // Check in case of reconnect
            if ((shot.playerid == player.id) && (shot.shotid >= shotid)) shotid = shot.shotid + 1
        }
    })
    socket.on('base', function(base) {
        bases[base.id] = base
    })
    socket.on('now', function(now) {
        newtimedrift = (now - (new Date().getTime()))
    })
}

function boom(base)
{
    let now = new Date().getTime() + timedrift
    let myfirstshot = null
    for (let sid in shots) {
        let s = shots[sid]
        if ((s.playerid == player.id) && (s.state == 'run')) {
            if (!myfirstshot || (myfirstshot > s.shotid)) {
                myfirstshot = s.shotid
            }
        }
    }
    if (myfirstshot) {
        boomshot(shots[player.id+'-'+myfirstshot.toString(36)], now)
    }
}

function boomshot(shot, now)
{
    shot.targetx = shot.startx + (shot.targetx-shot.startx) * ((now-shot.tick) / shot.time)
    shot.targety = shot.starty + (shot.targety-shot.starty) * ((now-shot.tick) / shot.time)
    shot.tick = now
    shot.state = 'boom'
    shots[shot.id] = shot
    socket.emit('shot',shot)
}

function shoot(base)
{
    let now = update(base)
    let shot =
    { id: player.id+'-'+shotid.toString(36)
    , shotid: shotid
    , playerid: player.id
    , tick: now
    , state: 'run'
    , ofa: Math.random() * Math.PI * 2
    , boomsize: gamecfg.boomsize
    , boomtime: gamecfg.boomtime
    , fadetime: gamecfg.boomfadetime
    , startx: base.basex + gamecfg.shotstart * Math.sin(base.turn.angle * Math.PI/180)
    , starty: base.basey - gamecfg.shotstart * Math.cos(base.turn.angle * Math.PI/180)
    , targetx: base.basex + gamecfg.shotend * Math.sin(base.turn.angle * Math.PI/180)
    , targety: base.basey - gamecfg.shotend * Math.cos(base.turn.angle * Math.PI/180)
    , time: (gamecfg.shotend-gamecfg.shotstart)/gamecfg.shotspeed
    , flashSpeed: 100
    , strokeStyle: 'rgba(255,150,130,1)'
    , fillStyle: 'rgba(200,180,160,1)'
    , pixSize: 2
    , lineMin: 1
    , lineMax: 1
    , boomStroke: 'rgba(64,220,255,0.5)'
    , boomFill: '#de8'
    , boomLine: 2
    , zIndex: 1
    }
    shotid++
    shots[shot.id] = shot
    socket.emit('shot', shot)
}

function timer(ctx, mybase)
{
    if (timedrift != newtimedrift) {
        if ((timedrift === null) || (Math.abs(timedrift - newtimedrift) <= gamecfg.drift)) {
            timedrift = newtimedrift
        } else if (timedrift > newtimedrift) {
            timedrift -= gamecfg.drift
        } else {
            timedrift += gamecfg.drift
        }
    }
    if (player.connected) {
        update(player.base)
        animate(player.base)
    }
}

function update(mybase)
{
    let now = new Date().getTime() + timedrift
    for (let b in bases) {
        let base = bases[b]
        if (base.turn.dir) {
              base.turn.angle = base.turn.prv + base.turn.dir * gamecfg.turnspeed * (now - base.turn.start)
              if (base.turn.angle < -90) {
                  base.turn.angle = -90
                  base.turn.prv   = -90
                  base.turn.dir   =   0
                  if (b == mybase) socket.emit('base',base)
              }
              if (base.turn.angle >  90) {
                  base.turn.angle =  90
                  base.turn.prv   =  90
                  base.turn.dir   =   0
                  if (b == mybase) socket.emit('base',base)
              }
        }
    }
    return now
}

function animate(mybase)
{
    let ctx = document.getElementById('canvas').getContext('2d')
    let now = new Date().getTime() + timedrift
    let phase = (now % gamecfg.dashspd)/gamecfg.dashspd

    // Start
    ctx.setTransform(1,0,0,1,0,0)
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.setLineDash([])

    ctx.translate(ctx.canvas.width/2, 0)

    for (let b in bases) {
        let base = bases[b]
        // Base
        ctx.lineWidth = 1
        if (b == mybase) {
            ctx.strokeStyle = '#fff'
            ctx.fillStyle = '#1c9'
        } else if (!base.player) {
            ctx.strokeStyle = '#555'
            ctx.fillStyle = '#322'
        } else if (base.state == 'disconnected') {
            ctx.strokeStyle = '#555'
            ctx.fillStyle = '#611'
        } else {
            ctx.strokeStyle = '#aaa'
            ctx.fillStyle = '#168'
        }
        ctx.beginPath()
        ctx.arc(base.basex, base.basey+gamecfg.baseoffset, gamecfg.basesize, Math.PI, 0)
        ctx.closePath()
        ctx.stroke()
        ctx.fill()

        // Gun
        ctx.strokeStyle = ctx.fillStyle
        ctx.beginPath()
        ctx.lineWidth = 3
        ctx.moveTo(base.basex, base.basey)
        ctx.lineTo(base.basex + gamecfg.gunlen * Math.sin(base.turn.angle * Math.PI/180), base.basey - gamecfg.gunlen * Math.cos(base.turn.angle * Math.PI/180))
        ctx.stroke()
    }

    let base = bases[mybase]

    // Dashed aiming line
    ctx.beginPath()
    let dash
    if (phase <= gamecfg.dashpart) {
        dash = [gamecfg.dashlen*phase,gamecfg.dashlen*(1-gamecfg.dashpart),gamecfg.dashlen*(gamecfg.dashpart-phase),0]
    } else {
        dash = [0,gamecfg.dashlen*(phase-gamecfg.dashpart),gamecfg.dashlen*gamecfg.dashpart,gamecfg.dashlen*(1-phase)]
    }
    ctx.setLineDash(dash)
    ctx.moveTo(base.basex + gamecfg.gunlen * Math.sin(base.turn.angle * Math.PI/180), base.basey - gamecfg.gunlen * Math.cos(base.turn.angle * Math.PI/180))
    ctx.lineTo(base.basex + 1000 * Math.sin(base.turn.angle * Math.PI/180), base.basey - 1000 * Math.cos(base.turn.angle * Math.PI/180))
    ctx.strokeStyle = '#c5a'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.strokeStyle = '#638'
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.setLineDash([])

    // Shots
    for (let i in shots) {
        let s = shots[i]
        let spos = (now - s.tick) / s.time
        if ((s.state == 'run') && (spos > 1)) {
            s.state = 'boom'
            s.tick = s.tick + s.time
        }
        if (s.state == 'run') {
            ctx.beginPath()
            let x2 = s.startx + (s.targetx-s.startx) * ((now-s.tick) / s.time)
            let y2 = s.starty + (s.targety-s.starty) * ((now-s.tick) / s.time)
            ctx.moveTo(s.startx,s.starty)
            ctx.lineTo(x2,y2)
            ctx.strokeStyle = 'rgba(64,220,255,0.5)'
            ctx.lineWidth = 4
            ctx.stroke()
            ctx.strokeStyle = 'rgba(17,102,176,1)'
            ctx.lineWidth = 2
            ctx.stroke()

            let phase = (spos*100) % 2
            if (phase > 1) phase = 2-phase
            ctx.lineWidth = s.lineMin + (s.lineMax-s.lineMin)*phase
            ctx.strokeStyle = s.strokeStyle.replace('phase',phase)
            ctx.fillStyle = s.fillStyle.replace('phase',phase)

            ctx.beginPath()
            ctx.arc(x2,y2,s.pixSize,0,Math.PI*2)
            ctx.stroke()
            ctx.fill()
        }
        if (s.state == 'boom') {
            let sfd = (now - s.tick) * gamecfg.fadespeed
            if (sfd < 1) {
                ctx.beginPath()
                ctx.moveTo(s.startx,s.starty)
                ctx.lineTo(s.targetx,s.targety)
                ctx.strokeStyle = 'rgba(64,220,255,'+0.5*(1.0-sfd)+')'
                ctx.lineWidth = 4
                ctx.stroke()
                ctx.strokeStyle = 'rgba(17,102,176,'+(1.0-sfd)+')'
                ctx.lineWidth = 2
                ctx.stroke()
            }
        }
    }
    // Explosions (order by shots first, then bombs)
    let shotlist = []
    for (let i in shots) {
        shotlist.push(shots[i])
    }
    shotlist.sort(function(a,b) { return a.zIndex - b.zIndex })
    // Draw them
    for (let i = 0; i < shotlist.length; i++) {
        let s = shotlist[i]
        if (s.tick <= now) {
            if (s.state == 'boom') {
                let bpos = (now - s.tick) / s.boomtime
                let bsz = Math.sqrt(bpos) * s.boomsize
                ctx.fillStyle = s.boomFill
                ctx.strokeStyle = s.boomStroke
                ctx.lineWidth = s.boomLine
                ctx.beginPath()
                ctx.arc(s.targetx, s.targety, bsz, 0, Math.PI*2)
                ctx.stroke()
                ctx.fill()
                if (bpos >= 1) {
                    let fpos = ((now - s.tick - s.boomtime) / s.fadetime)
                    let fsz = fpos * s.boomsize * 1.2
                    let xo = s.targetx + Math.sin(s.ofa)*((s.boomsize*1.5)-fsz)/2
                    let yo = s.targety - Math.cos(s.ofa)*((s.boomsize*1.5)-fsz)/2
                    ctx.beginPath()
                    ctx.arc(xo, yo, fsz, 0, Math.PI*2)
                    ctx.fillStyle = 'rgba(0,17,34,1)'
                    ctx.strokeStyle = 'rgba(0,17,34,0.5)'
                    ctx.lineWidth = 2
                    ctx.stroke()
                    ctx.fill()
                    if (fpos >= 1) {
                        s.state = 'done'
                        delete shots[s.id]
                    }
                }
            }
        }
    }
}
