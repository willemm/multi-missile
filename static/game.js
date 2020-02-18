const socket = io()
let player = {
    id: null,
    name: null
}
let gamecfg = {
    basesize: 25,
    turnspeed: 90 / 5000,
    dashspd: 500,
    gunlen: 20,
    shotstart: 22,
    dashlen: 10,
    dashpart: 0.2,
    shotspeed: 100 / 1000,
    fadespeed: 1 / 1000,

    boomsize: 50,
    boomspeed: 1 / 2000,
    boomfade: 0.3
}
let shotid = 0
let shots = {}
let bases = {}
let pressed_up = false
let pressed_down = false

// let tmr
// let ctx

window.onresize = function() {
    let canvas = document.getElementById('canvas')
    canvas.width = canvas.height * canvas.offsetWidth / canvas.offsetHeight
}

function setup_base(mybase)
{
    document.addEventListener('keydown', function(event) {
        let now = new Date().getTime()
        let turndir = 1
        let base = bases[mybase]
        switch (event.keyCode) {
            case 37: // LEFT
            case 65: // A
                turndir = -1
                // fallthrough
            case 39: // RIGHT
            case 68: // D
                if (!base.turn.dir) {
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
        let now = new Date().getTime()
        let base = bases[mybase]
        switch (event.keyCode) {
            case 37: // LEFT
            case 65: // A
                // Fallthrough: Same code
            case 39: // RIGHT
            case 68: // D
                if (base.turn.dir) {
                    base.turn.angle = base.turn.prv + base.turn.dir * gamecfg.turnspeed * (now - base.turn.start)
                    if (base.turn.angle < -90) base.turn.angle = -90
                    if (base.turn.angle >  90) base.turn.angle =  90
                    base.turn.prv = base.turn.angle
                    base.turn.dir = 0
                    socket.emit('base',base)
                }
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
    socket.on('start', function(base) {
        bases[base.basex] = base
        let ctx = document.getElementById('canvas').getContext('2d')
        setInterval(timer, 40, ctx, base.basex)

        if (base.type == 'base') {
            setup_base(base.basex)
        }
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
        bases[base.basex] = base
    })

    player.id = sessionStorage.getItem('playerid')
    socket.on('newplayer', function(playerid) {
        if (!player.id) {
            player.id = playerid
            sessionStorage.setItem('playerid', player.id)
            socket.emit('join', player)
        }
    })
    if (player.id) { socket.emit('join', player) } else { socket.emit('newplayer') }
}

function boom(base)
{
    let now = new Date().getTime()
    let myfirstshot = null
    for (sid in shots) {
        let s = shots[sid]
        if ((s.playerid == player.id) && (s.state == 'run')) {
            if (!myfirstshot || (myfirstshot > s.id)) {
                myfirstshot = s.id
            }
        }
    }
    if (myfirstshot) {
        let s = shots[myfirstshot]
        s.expos = (now - s.tick) * s.speed
        s.state = 'boom'
        s.tick = now-1
        shots[s.id] = s
        socket.emit('shot',s)
    }
}

function shoot(base)
{
    shotid++
    let now = update(base)
    let shot = {
        id: player.id+'-'+shotid,
        shotid: shotid,
        playerid: player.id,
        angle: base.turn.angle,
        tick: now,
        state: 'run',
        expos: 0,
        ofa: Math.random() * Math.PI * 2,
        speed: gamecfg.shotspeed,
        startx: base.basex + gamecfg.shotstart * Math.sin(base.turn.angle * Math.PI/180),
        starty: base.basey - gamecfg.shotstart * Math.cos(base.turn.angle * Math.PI/180)
    }
    shots[shot.id] = shot
    socket.emit('shot', shot)
}

function timer(ctx, mybase)
{
    update(mybase)
    animate(ctx, mybase)
}

function update(mybase)
{
    let now = new Date().getTime()
    for (b in bases) {
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

function animate(ctx, mybase)
{
    let now = new Date().getTime()
    let phase = (now % gamecfg.dashspd)/gamecfg.dashspd

    // Start
    ctx.setTransform(1,0,0,1,0,0)
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.setLineDash([])

    ctx.translate(ctx.canvas.width/2, 0)

    for (b in bases) {
        let base = bases[b]
        // Base
        ctx.shadowBlur = 3
        if (!base.player) {
            ctx.shadowColor = '#555'
            ctx.fillStyle = '#322'
        } else if (b == mybase) {
            ctx.shadowColor = '#fff'
            ctx.fillStyle = '#1c9'
        } else {
            ctx.shadowColor = '#aaa'
            ctx.fillStyle = '#168'
        }
        ctx.beginPath()
        ctx.arc(base.basex, base.basey+gamecfg.basesize, gamecfg.basesize, Math.PI, 0)
        ctx.closePath()
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
    ctx.strokeStyle = '#638'
    ctx.lineWidth = 1
    ctx.shadowBlur = 2
    ctx.shadowColor = '#c5a'
    let dash
    if (phase <= gamecfg.dashpart) {
        dash = [gamecfg.dashlen*phase,gamecfg.dashlen*(1-gamecfg.dashpart),gamecfg.dashlen*(gamecfg.dashpart-phase),0]
    } else {
        dash = [0,gamecfg.dashlen*(phase-gamecfg.dashpart),gamecfg.dashlen*gamecfg.dashpart,gamecfg.dashlen*(1-phase)]
    }
    ctx.setLineDash(dash)
    ctx.moveTo(base.basex + gamecfg.gunlen * Math.sin(base.turn.angle * Math.PI/180), base.basey - gamecfg.gunlen * Math.cos(base.turn.angle * Math.PI/180))
    ctx.lineTo(base.basex + 1000 * Math.sin(base.turn.angle * Math.PI/180), base.basey - 1000 * Math.cos(base.turn.angle * Math.PI/180))
    ctx.stroke()

    ctx.setLineDash([])

    // Shots
    for (i in shots) {
        let s = shots[i]
        let spos = (now - s.tick) * s.speed
        if (s.state == 'run' && spos >= 1000) {
            s.expos = 1000
            s.state = 'done'
            s.tick = now-1
            socket.emit('shot', s)
        }
        if (s.state == 'run') {
            ctx.shadowBlur = 8
            ctx.shadowColor = 'rgba(64,220,255,0.5)'
            ctx.strokeStyle = 'rgba(17,102,176,1)'
            ctx.lineWidth = 2
            ctx.beginPath()
            let x2 = s.startx + spos * Math.sin(s.angle * Math.PI/180)
            let y2 = s.starty - spos * Math.cos(s.angle * Math.PI/180)
            ctx.moveTo(s.startx,s.starty)
            ctx.lineTo(x2,y2)
            ctx.stroke()
        }
        if (s.state == 'boom') {
            let sfd = (now - s.tick) * gamecfg.fadespeed
            let x2 = s.startx + s.expos * Math.sin(s.angle * Math.PI/180)
            let y2 = s.starty - s.expos * Math.cos(s.angle * Math.PI/180)
            if (sfd < 1) {
                ctx.shadowBlur = 8
                ctx.shadowColor = 'rgba(64,220,255,'+0.5*(1.0-sfd)+')'
                ctx.strokeStyle = 'rgba(17,102,176,'+(1.0-sfd)+')'
                ctx.lineWidth = 2
                ctx.beginPath()
                ctx.moveTo(s.startx,s.starty)
                ctx.lineTo(x2,y2)
                ctx.stroke()
            }
        }
    }
    // Explosions (all drawn after shots)
    for (i in shots) {
        let s = shots[i]
        if (s.state == 'boom') {
            let x2 = s.startx + s.expos * Math.sin(s.angle * Math.PI/180)
            let y2 = s.starty - s.expos * Math.cos(s.angle * Math.PI/180)
            let bpos = (now - s.tick) * gamecfg.boomspeed
            let bsz = Math.sqrt(bpos) * gamecfg.boomsize
            ctx.beginPath()
            ctx.arc(x2, y2, bsz, 0, Math.PI*2)
            ctx.fillStyle = '#de8'
            ctx.shadowBlur = 8
            ctx.shadowColor = 'rgba(64,220,255,0.5)'
            ctx.fill()
            if (bpos >= 1) {
                let fsz = ((bpos-1) / gamecfg.boomfade) * gamecfg.boomsize * 1.2
                let x3 = x2 + Math.sin(s.ofa)*((gamecfg.boomsize*1.5)-fsz)/2
                let y3 = y2 - Math.cos(s.ofa)*((gamecfg.boomsize*1.5)-fsz)/2
                ctx.beginPath()
                ctx.arc(x3, y3, fsz, 0, Math.PI*2)
                ctx.fillStyle = 'rgba(0,17,34,1)'
                ctx.shadowBlur = 10
                ctx.shadowColor = 'rgba(0,17,34,1)'
                ctx.fill()
                if (bpos >= (1 + gamecfg.boomfade)) {
                    s.state = 'done'
                    socket.emit('shot', s)
                }
            }
        }
    }
}
