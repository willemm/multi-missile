let gamestate = {
    basex: 100,
    basey: 540,
    angle: 0,
    prvangle: 0,
    shooting: false,
    booming: false
}
let gamecfg = {
    basesize: 20,
    turnspeed: 90 / 5000,
    dashspd: 500,
    dashlen: 10,
    dashpart: 0.2,
    shotspeed: 100 / 1000,
    fadespeed: 1 / 1000,

    boomsize: 50,
    boomspeed: 1 / 2000,
    boomfade: 0.3
}
let shots = []

// let tmr
// let ctx

window.onload = function() {
    let ctx = document.getElementById('canvas').getContext('2d')
    setInterval(timer, 40, ctx)

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
                    shoot()
                }
                break
            case 40: // DOWN
            case 83: // S
                if (!gamestate.booming) {
                    gamestate.booming = true
                    boom()
                }
                break
        }
    });
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
    });
}

function boom()
{
    let now = new Date().getTime()
    for (let i = 0; i < shots.length; i++) {
        if (shots[i].state == 'run') {
            shots[i].expos = (now - shots[i].tick) * gamecfg.shotspeed
            shots[i].state = 'boom'
            shots[i].tick = now-1
            return
        }
    }
}

function shoot()
{
    let now = update()
    shots.push({
        angle: gamestate.angle,
        tick: now,
        state: 'run',
        expos: 0,
        ofa: Math.random() * Math.PI * 2
    })
}

function timer(ctx)
{
    update()
    animate(ctx)
}

function update()
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

function animate(ctx)
{
    let now = new Date().getTime()
    let phase = (now % gamecfg.dashspd)/gamecfg.dashspd

    // Start
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.setLineDash([])

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
    ctx.lineTo(gamestate.basex + 10 * Math.sin(gamestate.angle * Math.PI/180), gamestate.basey - 10 * Math.cos(gamestate.angle * Math.PI/180))
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
    ctx.moveTo(gamestate.basex + 10 * Math.sin(gamestate.angle * Math.PI/180), gamestate.basey - 10 * Math.cos(gamestate.angle * Math.PI/180))
    ctx.lineTo(gamestate.basex + 1000 * Math.sin(gamestate.angle * Math.PI/180), gamestate.basey - 1000 * Math.cos(gamestate.angle * Math.PI/180))
    ctx.stroke()

    ctx.setLineDash([])

    // Shots
    for (let i = 0; i < shots.length; i++) {
        let s = shots[i]
        let x1 = gamestate.basex + 15 * Math.sin(s.angle * Math.PI/180)
        let y1 = gamestate.basey - 15 * Math.cos(s.angle * Math.PI/180)
        let spos = (now - s.tick) * gamecfg.shotspeed
        if (spos >= 1000) {
            s.expos = 1000
            s.state = 'boom'
            s.tick = now-1
        }
        if (s.state == 'run') {
            ctx.shadowBlur = 8
            ctx.shadowColor = 'rgba(64,220,255,0.5)'
            ctx.strokeStyle = 'rgba(17,102,176,1)'
            ctx.lineWidth = 2
            ctx.beginPath()
            let x2 = gamestate.basex + spos * Math.sin(s.angle * Math.PI/180)
            let y2 = gamestate.basey - spos * Math.cos(s.angle * Math.PI/180)
            ctx.moveTo(x1,y1)
            ctx.lineTo(x2,y2)
            ctx.stroke()
        }
        if (s.state == 'boom') {
            let sfd = (now - s.tick) * gamecfg.fadespeed
            let x2 = gamestate.basex + s.expos * Math.sin(s.angle * Math.PI/180)
            let y2 = gamestate.basey - s.expos * Math.cos(s.angle * Math.PI/180)
            if (sfd < 1) {
                ctx.shadowBlur = 8
                ctx.shadowColor = 'rgba(64,220,255,'+0.5*(1.0-sfd)+')'
                ctx.strokeStyle = 'rgba(17,102,176,'+(1.0-sfd)+')'
                ctx.lineWidth = 2
                ctx.beginPath()
                ctx.moveTo(x1,y1)
                ctx.lineTo(x2,y2)
                ctx.stroke()
            }
        }
    }
    for (let i = 0; i < shots.length; i++) {
        let s = shots[i]
        if (s.state == 'boom') {
            let x2 = gamestate.basex + s.expos * Math.sin(s.angle * Math.PI/180)
            let y2 = gamestate.basey - s.expos * Math.cos(s.angle * Math.PI/180)
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
                }
            }
        }
    }
    let i2 = 0
    for (let i = 0; i < shots.length; i++) {
        if (shots[i].state != 'done') {
            shots[i2++] = shots[i]
        }
    }
    shots.length = i2
}
/*
function shoot()
{
    s1ang = Math.random() * 95 + 260
    s1pos = 25
    s1len = Math.random() * 200 + 400
    s1ofa = Math.random() * Math.PI * 2
}
function animate()
{
    s1pos = s1pos + s1spd
    if (s1pos < s1len) {
        let s0 = s1pos-s1spd*5
        if (s0<25) s0=25
        let x0 = m1x + s0 * Math.cos(s1ang * Math.PI/180)
        let y0 = m1y + s0 * Math.sin(s1ang * Math.PI/180)
        let x1 = m1x + (s1pos-s1spd) * Math.cos(s1ang * Math.PI/180)
        let y1 = m1y + (s1pos-s1spd) * Math.sin(s1ang * Math.PI/180)
        let x2 = m1x + s1pos * Math.cos(s1ang * Math.PI/180)
        let y2 = m1y + s1pos * Math.sin(s1ang * Math.PI/180)

        ctx.shadowBlur = 8
        ctx.shadowColor = 'rgba(64,220,255,0.5)'
        ctx.strokeStyle = '#16a'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x0,y0)
        ctx.lineTo(x2,y2)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(x2,y2,1,0,Math.PI*2)
        ctx.fillStyle = '#fff'
        ctx.fill()
    } else if (s1pos < s1len+200) {
        let bsz = (s1pos-s1len)/5
        let x = m1x + s1len * Math.cos(s1ang * Math.PI/180)
        let y = m1y + s1len * Math.sin(s1ang * Math.PI/180)
        ctx.beginPath()
        ctx.arc(x, y, bsz, 0, Math.PI*2)
        ctx.fillStyle = '#de8'
        ctx.shadowBlur = 8
        ctx.shadowColor = 'rgba(64,220,255,0.5)'
        ctx.fill()
    } else if (s1pos < s1len+300) {
        let bsz = (s1pos-s1len-200)/2
        let x = m1x + s1len * Math.cos(s1ang * Math.PI/180) + Math.cos(s1ofa)*(50-bsz)/2
        let y = m1y + s1len * Math.sin(s1ang * Math.PI/180) + Math.sin(s1ofa)*(50-bsz)/2
        ctx.beginPath()
        ctx.arc(x, y, bsz, 0, Math.PI*2)
        ctx.fillStyle = 'rgba(0,17,34,1)'
        ctx.shadowBlur = 10
        ctx.shadowColor = 'rgba(0,17,34,1)'
        ctx.fill()

        let x1 = m1x + 25 * Math.cos(s1ang * Math.PI/180)
        let y1 = m1y + 25 * Math.sin(s1ang * Math.PI/180)
        let x2 = m1x + (s1len-44) * Math.cos(s1ang * Math.PI/180)
        let y2 = m1y + (s1len-44) * Math.sin(s1ang * Math.PI/180)
        ctx.strokeStyle = 'rgba(0,17,34,1)'
        ctx.shadowBlur = 5
        ctx.shadowColor = 'rgba(0,17,34,1)'
        ctx.lineWidth = bsz/4
        ctx.beginPath()
        ctx.moveTo(x1,y1)
        ctx.lineTo(x2,y2)
        ctx.stroke()
    } else {
        shoot()
    }
}
*/
