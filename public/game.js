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
    turnspeed: 90 / 5000,
    dashspd: 500,
    gunlen: 20,
    shotstart: 22,
    dashlen: 10,
    dashpart: 0.2,
    shotspeed: 120 / 1000,
    fadespeed: 1 / 1000,

    boomsize: 50,
    boomtime: 2000,
    boomfadetime: 600
}
let shotid = 0
let shots = {}
let bombs = {}
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
    socket.on('bomb', function(bomb) {
        if (bomb.state == 'done') {
            delete bombs[bomb.id]
        } else {
            bombs[bomb.id] = bomb
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
    for (sid in shots) {
        let s = shots[sid]
        if ((s.playerid == player.id) && (s.state == 'run')) {
            if (!myfirstshot || (myfirstshot > s.shotid)) {
                myfirstshot = s.shotid
            }
        }
    }
    if (myfirstshot) {
        boomshot(shots[player.id+'-'+myfirstshot], 0, now)
    }
}

function boomshot(shot, expos, now)
{
    if (!expos) expos = (now - shot.tick) * shot.speed
    shot.boomx = shot.startx + expos * Math.sin(shot.angle * Math.PI/180)
    shot.boomy = shot.starty - expos * Math.cos(shot.angle * Math.PI/180)
    shot.state = 'boom'
    shot.tick = now
    shots[shot.id] = shot
    socket.emit('shot',shot)
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
        ofa: Math.random() * Math.PI * 2,
        speed: gamecfg.shotspeed,
        boomsize: gamecfg.boomsize,
        boomtime: gamecfg.boomtime,
        fadetime: gamecfg.boomfadetime,
        startx: base.basex + gamecfg.shotstart * Math.sin(base.turn.angle * Math.PI/180),
        starty: base.basey - gamecfg.shotstart * Math.cos(base.turn.angle * Math.PI/180)
    }
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

    for (b in bases) {
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
        ctx.arc(base.basex, base.basey+gamecfg.basesize, gamecfg.basesize, Math.PI, 0)
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
    for (i in shots) {
        let s = shots[i]
        let spos = (now - s.tick) * s.speed
        if ((s.state == 'run') && (spos >= 1500) && (s.playerid == player.id)) {
            boomshot(s, 1500, now)
        }
        if (s.state == 'run') {
            ctx.beginPath()
            let x2 = s.startx + spos * Math.sin(s.angle * Math.PI/180)
            let y2 = s.starty - spos * Math.cos(s.angle * Math.PI/180)
            ctx.moveTo(s.startx,s.starty)
            ctx.lineTo(x2,y2)
            ctx.strokeStyle = 'rgba(64,220,255,0.5)'
            ctx.lineWidth = 4
            ctx.stroke()
            ctx.strokeStyle = 'rgba(17,102,176,1)'
            ctx.lineWidth = 2
            ctx.stroke()

            ctx.beginPath()
            ctx.arc(x2,y2,2,0,Math.PI*2)
            ctx.strokeStyle = 'rgba(255,150,130,1)'
            ctx.fillStyle = 'rgba(200,180,160,1)'
            ctx.lineWidth = 1
            ctx.stroke()
            ctx.fill()
        }
        if (s.state == 'boom') {
            let sfd = (now - s.tick) * gamecfg.fadespeed
            if (sfd < 1) {
                ctx.beginPath()
                ctx.moveTo(s.startx,s.starty)
                ctx.lineTo(s.boomx,s.boomy)
                ctx.strokeStyle = 'rgba(64,220,255,'+0.5*(1.0-sfd)+')'
                ctx.lineWidth = 4
                ctx.stroke()
                ctx.strokeStyle = 'rgba(17,102,176,'+(1.0-sfd)+')'
                ctx.lineWidth = 2
                ctx.stroke()
            }
        }
    }
    for (i in bombs) {
        let b = bombs[i]
        let spos = (now - b.tick) / b.time
        if (spos >= 0) {
            if ((b.state == 'run') && (spos > 1)) {
                b.state = 'boom'
                b.tick = b.tick + b.time
            }
            if (b.state == 'run') {
                ctx.beginPath()
                let x2 = b.startx + (b.targetx - b.startx) * spos
                let y2 = b.starty + (b.targety - b.starty) * spos
                ctx.moveTo(b.startx,b.starty)
                ctx.lineTo(x2,y2)
                ctx.strokeStyle = 'rgba(64,220,255,0.5)'
                ctx.lineWidth = 4
                ctx.stroke()
                ctx.strokeStyle = 'rgba(17,102,176,1)'
                ctx.lineWidth = 2
                ctx.stroke()

                let phase = (spos*100) % 2
                if (phase > 1) phase = 2-phase
                ctx.lineWidth = 4*phase
                ctx.strokeStyle = 'rgba(255,100,80,'+phase+')'
                ctx.fillStyle = 'rgba(200,150,100,1)'
                ctx.beginPath()
                ctx.arc(x2,y2,1.5,0,Math.PI*2)
                ctx.stroke()
                ctx.fill()
            }
            if (b.state == 'boom') {
                let sfd = (now - b.tick) * gamecfg.fadespeed
                if (sfd < 1) {
                    ctx.beginPath()
                    ctx.moveTo(b.startx,b.starty)
                    ctx.lineTo(b.targetx,b.targety)
                    ctx.strokeStyle = 'rgba(64,220,255,'+(0.5 * (1.0-sfd))+')'
                    ctx.lineWidth = 4
                    ctx.stroke()
                    ctx.strokeStyle = 'rgba(17,102,176,'+(1.0-sfd)+')'
                    ctx.lineWidth = 2
                    ctx.stroke()
                }
            }
        }
    }
    // Explosions (all drawn after shots)
    for (i in shots) {
        let s = shots[i]
        if (s.state == 'boom') {
            let bpos = (now - s.tick) / s.boomtime
            let bsz = Math.sqrt(bpos) * s.boomsize
            ctx.beginPath()
            ctx.arc(s.boomx, s.boomy, bsz, 0, Math.PI*2)
            ctx.fillStyle = '#de8'
            ctx.strokeStyle = 'rgba(64,220,255,0.5)'
            ctx.lineWidth = 2
            ctx.stroke()
            ctx.fill()
            if (bpos >= 1) {
                let fpos = ((now - s.tick - s.boomtime) / s.fadetime)
                let fsz = fpos * s.boomsize * 1.2
                let xo = s.boomx + Math.sin(s.ofa)*((s.boomsize*1.5)-fsz)/2
                let yo = s.boomy - Math.cos(s.ofa)*((s.boomsize*1.5)-fsz)/2
                ctx.beginPath()
                ctx.arc(xo, yo, fsz, 0, Math.PI*2)
                ctx.fillStyle = 'rgba(0,17,34,1)'
                ctx.strokeStyle = 'rgba(0,17,34,1)'
                ctx.lineWidth = 2
                ctx.stroke()
                ctx.fill()
                if (fpos >= 1) {
                    s.state = 'done'
                    // socket.emit('shot', s)
                    delete shots[s.id]
                }
            }
        }
    }

    for (i in bombs) {
        let b = bombs[i]
        if (b.tick <= now) {
            if (b.state == 'boom') {
                let bpos = (now - b.tick) / b.boomtime
                let bsz = Math.sqrt(bpos) * b.boomsize
                if (b.target == 'ground') {
                    ctx.fillStyle = '#f77'
                    ctx.strokeStyle = 'rgba(64,220,255,0.5)'
                } else {
                    ctx.fillStyle = '#77f'
                    ctx.strokeStyle = 'rgba(220,64,255,0.5)'
                }
                ctx.lineWidth = 1
                ctx.beginPath()
                ctx.arc(b.targetx, b.targety, bsz, 0, Math.PI*2)
                ctx.stroke()
                ctx.fill()
                if (bpos >= 1) {
                    bpos = (now - b.tick - b.boomtime) / b.fadetime
                    let fsz = bpos * b.boomsize * 1.2
                    let xo = b.targetx + Math.sin(b.ofa)*((b.boomsize*1.5)-fsz)/2
                    let yo = b.targety - Math.cos(b.ofa)*((b.boomsize*1.5)-fsz)/2
                    ctx.beginPath()
                    ctx.arc(xo, yo, fsz, 0, Math.PI*2)
                    ctx.fillStyle = 'rgba(0,17,34,1)'
                    ctx.strokeStyle = 'rgba(0,17,34,0.5)'
                    ctx.lineWidth = 2
                    ctx.stroke()
                    ctx.fill()
                    if (bpos >= 1) {
                        b.state = 'done'
                        delete bombs[b.id]
                    }
                }
            }
        }
    }

}
