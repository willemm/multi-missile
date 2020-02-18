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
let myshots = []
let shots = {}
let shotcount = 0

// let tmr
// let ctx

window.onresize = function() {
    let canvas = document.getElementById('canvas')
    canvas.width = canvas.height * canvas.offsetWidth / canvas.offsetHeight
}

window.onload = function() {
    window.onresize()
    socket.on('start', function(gamestate) {
        let ctx = document.getElementById('canvas').getContext('2d')
        setInterval(timer, 40, ctx, gamestate)

        document.addEventListener('keydown', function(event) {
            let now = new Date().getTime()
            switch (event.keyCode) {
                case 37: // LEFT
                case 65: // A
                    if (!gamestate.turndir) {
                        gamestate.turnstart = now
                        gamestate.turndir = -1
                    }
                    break
                case 39: // RIGHT
                case 68: // D
                    if (!gamestate.turndir) {
                        gamestate.turnstart = now
                        gamestate.turndir = 1
                    }
                    break
                case 38: // UP
                case 87: // W
                    if (!gamestate.shooting) {
                        gamestate.shooting = true
                        shoot(gamestate)
                    }
                    break
                case 40: // DOWN
                case 83: // S
                    if (!gamestate.booming) {
                        gamestate.booming = true
                        boom(gamestate)
                    }
                    break
            }
        })
        document.addEventListener('keyup', function(event) {
            let now = new Date().getTime()
            switch (event.keyCode) {
                case 37: // LEFT
                case 65: // A
                    // Fallthrough: Same code
                case 39: // RIGHT
                case 68: // D
                    if (gamestate.turndir) {
                        gamestate.angle = gamestate.prvangle + gamestate.turndir * gamecfg.turnspeed * (now - gamestate.turnstart)
                        if (gamestate.angle < -90) gamestate.angle = -90
                        if (gamestate.angle >  90) gamestate.angle =  90
                        gamestate.prvangle = gamestate.angle
                        gamestate.turndir = 0
                    }
                    break
                case 38: // UP
                case 87: // W
                    gamestate.shooting = false
                    break
                case 40: // DOWN
                case 83: // S
                    gamestate.booming = false
                    break
            }
        })
    })
    socket.on('shot', function(shot) {
        if (shot.state == 'done') {
            delete shots[shot.id]
            let i2 = 0
            for (let i = 0; i < myshots.length; i++) {
                if (shots[myshots[i].id]) {
                    myshots[i2++] = myshots[i]
                }
            }
            myshots.length = i2
        } else {
            shots[shot.id] = shot
        }
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

function boom(gamestate)
{
    let now = new Date().getTime()
    for (let i = 0; i < myshots.length; i++) {
        let s = myshots[i]
        if (s.state == 'run') {
            s.expos = (now - s.tick) * s.speed
            s.state = 'boom'
            s.tick = now-1
            shots[s.id] = s
            socket.emit('shoot',s)
            return
        }
    }
}

function shoot(gamestate)
{
    shotcount++
    let shotid = player.id+'-'+shotcount
    let now = update(gamestate)
    let shot = {
        id: shotid,
        angle: gamestate.angle,
        tick: now,
        state: 'run',
        expos: 0,
        ofa: Math.random() * Math.PI * 2,
        speed: gamecfg.shotspeed,
        startx: gamestate.basex + gamecfg.shotstart * Math.sin(gamestate.angle * Math.PI/180),
        starty: gamestate.basey - gamecfg.shotstart * Math.cos(gamestate.angle * Math.PI/180)
    }
    myshots.push(shot)
    shots[shot.id] = shot
    socket.emit('shoot', shot)
}

function timer(ctx, gamestate)
{
    update(gamestate)
    animate(ctx, gamestate)
}

function update(gamestate)
{
    let now = new Date().getTime()
    if (gamestate.turndir) {
          gamestate.angle = gamestate.prvangle + gamestate.turndir * gamecfg.turnspeed * (now - gamestate.turnstart)
          if (gamestate.angle < -90) {
              gamestate.angle = -90
              gamestate.prvangle = -90
              gamestate.turndir = 0
          }
          if (gamestate.angle >  90) {
              gamestate.angle =  90
              gamestate.prvangle =  90
              gamestate.turndir = 0
          }
    }
    return now
}

function animate(ctx, gamestate)
{
    let now = new Date().getTime()
    let phase = (now % gamecfg.dashspd)/gamecfg.dashspd

    // Start
    ctx.setTransform(1,0,0,1,0,0)
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.setLineDash([])

    ctx.translate(ctx.canvas.width/2, 0)

    // Base
    ctx.shadowBlur = 3
    ctx.shadowColor = '#fff'
    ctx.fillStyle = '#1a8'
    ctx.beginPath()
    ctx.arc(gamestate.basex, gamestate.basey+gamecfg.basesize, gamecfg.basesize, Math.PI, 0)
    ctx.closePath()
    ctx.fill()

    // Gun
    ctx.strokeStyle = '#1a8'
    ctx.beginPath()
    ctx.lineWidth = 3
    ctx.moveTo(gamestate.basex, gamestate.basey)
    ctx.lineTo(gamestate.basex + gamecfg.gunlen * Math.sin(gamestate.angle * Math.PI/180), gamestate.basey - gamecfg.gunlen * Math.cos(gamestate.angle * Math.PI/180))
    ctx.stroke()

    // Dashed aiming line
    ctx.beginPath()
    ctx.strokeStyle = '#526'
    ctx.lineWidth = 1
    ctx.shadowBlur = 2
    ctx.shadowColor = '#805'
    let dash
    if (phase <= gamecfg.dashpart) {
        dash = [gamecfg.dashlen*phase,gamecfg.dashlen*(1-gamecfg.dashpart),gamecfg.dashlen*(gamecfg.dashpart-phase),0]
    } else {
        dash = [0,gamecfg.dashlen*(phase-gamecfg.dashpart),gamecfg.dashlen*gamecfg.dashpart,gamecfg.dashlen*(1-phase)]
    }
    ctx.setLineDash(dash)
    ctx.moveTo(gamestate.basex + gamecfg.gunlen * Math.sin(gamestate.angle * Math.PI/180), gamestate.basey - gamecfg.gunlen * Math.cos(gamestate.angle * Math.PI/180))
    ctx.lineTo(gamestate.basex + 1000 * Math.sin(gamestate.angle * Math.PI/180), gamestate.basey - 1000 * Math.cos(gamestate.angle * Math.PI/180))
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
            socket.emit('shoot', s)
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
                    socket.emit('shoot', s)
                }
            }
        }
    }
}
