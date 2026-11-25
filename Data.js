const fs = require('fs').promises;
const path = require('path');

const defaultData = {
    Chzzk:{
        ClientId: '',
        CallbackPort: 4100,
        RedirectUri: 'http://localhost:4100/chzzk/callback'
    },
    SocketPort: 4000,
}

const filePath = path.join(process.env.LOCALAPPDATA, 'VishaSTD/server', 'config.json');

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// 빠진 항목만 기본값으로 채운다 (명세 01 §4). 채운 것이 있으면 true. 있는 값은 형식이 달라도 건드리지 않는다.
function fillDefaults(target, defaults) {
    let filled = false;
    for (const [key, value] of Object.entries(defaults)) {
        if (target[key] === undefined) {
            target[key] = structuredClone(value);
            filled = true;
        } else if (isPlainObject(value) && isPlainObject(target[key])) {
            filled = fillDefaults(target[key], value) || filled;
        }
    }
    return filled;
}

const Data = {
    // 실패하면 null (호출하는 쪽이 종료한다)
    async loadData(){
        try{
            const dirPath = path.dirname(filePath);
            await fs.mkdir(dirPath, { recursive: true });
            let fileContent;
            try{
                fileContent = await fs.readFile(filePath, 'utf8');
            }catch(err)
            {
                if(err.code !== 'ENOENT') throw err;
                const data = structuredClone(defaultData);
                await this.saveData(data);
                return data;
            }
            const data = JSON.parse(fileContent);
            if (!isPlainObject(data)) throw Object.assign(new Error('CONFIG_INVALID'), { code: 'CONFIG_INVALID' });
            if (fillDefaults(data, defaultData)) await this.saveData(data);
            return data;
        }catch(err){
            console.error(`설정 파일 읽기 실패: ${err.code || err.name}`);
            return null;
        }
    },
    async saveData(data)
    {
        try{
            await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
        }catch(err)
        {
            console.log('failed save Datas. : ', err);
        }
    }
}

module.exports = Data; 