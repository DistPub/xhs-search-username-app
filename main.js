auto.waitFor()

let t = log
let e = exit
let s = sleep
let i = setText

let si = (idStr) => id(idStr)
let st = (textStr) => text(textStr)
let vi = () => undefined
let cache = {}

function findItem(itemSelector, todoDesc, options) {
    let { to, sleepTime, forceExit } = options
    to = to || vi
    sleepTime = sleepTime || 1000
    forceExit = forceExit || false


    if (!itemSelector.exists()) {
        let message = "找不到控件，无法完成" + todoDesc
        t(message)

        if (forceExit) {
            throw message
        }

        return null
    } else {
        t(todoDesc)
        let item = itemSelector.findOne()
        to(item) && s(sleepTime)
        return item
    }
}

function fi(idStr, todoDesc, options) {
    return findItem(si(idStr), todoDesc, options)
}

function ft(textStr, todoDesc, options) {
    return findItem(st(textStr), todoDesc, options)
}

function getJsonResponse(response) {
    if (response.statusCode !== 200 && response.statusCode !== 201) {
        t('服务器错误')
        e()
    }
    return response.body.json()
}

function updateTask(task) {
    let response = http.request('https://relax.smitechow.com/tasks/' + task._id, { method: 'PUT', contentType: 'application/json', body: JSON.stringify(task) })
    task._rev = getJsonResponse(response).rev
}

function searchUser(username) {
    fi("e6o", "找到搜索入口，进入", { to: item => item.click() })
    fi("cp5", "找到原始搜索框，输入", { to: item => item.click() }) || fi("coz", "找到历史搜索框，输入", { to: item => item.click() })
    fi("cp8", "找到搜索按钮，搜索", {
        to: item => {
            i(username) && item.click()
        }, forceExit: true
    })

    let searchUserButton = ft("用户", "找到用户tab，切换", {
        to: item => {
            click(item.bounds().centerX(), item.bounds().centerY())
        }, forceExit: true, sleepTime: 3000
    })

    fi('cor', '找到列表，读取', { forceExit: true })

    function getInfo(item) {
        let nick = item.findOne(si('cpc')).text()
        let key = item.findOne(si('cpd')).text()
        let statistic = item.findOne(si('cpa')).text()
        return [nick, key, statistic]
    }

    let results = []
    let collection = className('android.widget.RelativeLayout').clickable().find()
    t('结果数量：' + collection.length)

    if (collection.length === 0) {
        throw '结果数量为0'
    }

    for (let idx = 0; idx < collection.length; idx++) {
        t('读取=>' + (idx + 1))
        results.push(getInfo(collection[idx]))
    }
    return results
}

function handleTask() {
    t('获取任务')
    let response = http.request('https://relax.smitechow.com/tasks/_find', {
        method: 'POST', contentType: 'application/json', body: JSON.stringify({
            selector: {
                status: 0,
                type: 'xhs/search/username'
            },
            limit: 1
        })
    })

    let task = getJsonResponse(response)

    if (!task.docs.length) {
        t('获取任务失败：无可做任务')
        return
    }

    task = task.docs[0]

    t('抢占任务' + task._id)
    task.status = 1
    updateTask(task)

    t('执行任务' + task._id)
    let app = launchApp("小红书")
    if (!app) {
        t("打开小红书失败")
        return
    } else {
        s(3000)
    }

    try {
        let data = {}
        for (let idx = 0; idx < task.args.length; idx++) {
            let username = task.args[idx]
            t('搜索用户名：' + username)

            if (cache[username]) {
                t('复用缓存中已有搜索结果')
                data[username] = cache[username]
            } else {
                data[username] = searchUser(username)
                cache[username] = data[username]
            }
        }

        t('上传任务结果')
        task.status = 2
        task.data = data
        updateTask(task)

        t('成功执行任务' + task._id)
    } catch (error) {
        t(error)
        t('错误，放弃执行任务' + task._id)
        task.status = 0
        updateTask(task)
    }
}

let status = 0
setInterval(function () {
    if (status) {
        return
    }
    status = 1
    handleTask()
    status = 0
}, 3000)