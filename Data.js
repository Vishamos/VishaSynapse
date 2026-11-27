const fs = require('fs').promises;
const path = require('path');
const { Log, LogCode } = require('./VishaSynapse/VSLog');

const defaultData = {
    Chzzk:{
        ClientId: '',
        CallbackPort: 4100,
        RedirectUri: 'http://localhost:4100/chzzk/callback'
    },
    SocketPort: 4000,
    ControllerShutdownMinutes: 10, // 명세 02 §5.9.5
}

// 0 이상 숫자만 유효 (명세 02 §5.9.5, §5.9.10)
function isValidControllerShutdownMinutes(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
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
    // loadData로 읽은 설정. 실행 중 config.set이 바꾸고 저장한다 (명세 02 §5.9.8)
    current: null,
    isValidControllerShutdownMinutes,
    // 잘못된 값(0 미만, 숫자 아님)이면 기본값 (§5.9.5)
    controllerShutdownMinutes(){
        const value = this.current ? this.current.ControllerShutdownMinutes : undefined;
        return isValidControllerShutdownMinutes(value) ? value : defaultData.ControllerShutdownMinutes;
    },
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
                this.current = data;
                return data;
            }
            const data = JSON.parse(fileContent);
            if (!isPlainObject(data)) throw Object.assign(new Error('CONFIG_INVALID'), { code: 'CONFIG_INVALID' });
            if (fillDefaults(data, defaultData)) await this.saveData(data);
            this.current = data;
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
            Log.Error(LogCode.CONFIG_SAVE_FAILED, `설정 파일 저장 실패: ${err.code || err.name}`);
        }
    }
}

module.exports = Data; 