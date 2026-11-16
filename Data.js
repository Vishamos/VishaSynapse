const fs = require('fs').promises;
const path = require('path');

const defaultData = {
    ChatAPI:{
        IdHash: '',
        ChannelId: ''
    },
    SocketPort: 0,
}

const filePath = path.join(process.env.LOCALAPPDATA, 'VishaSTD/server', 'config.json');

const Data = {
    async loadData(){
        try{
            const dirPath = path.dirname(filePath);
            await fs.mkdir(dirPath, { recursive: true });
            try{
                const fileContent = await fs.readFile(filePath, 'utf8');
                return JSON.parse(fileContent);
            }catch(err)
            {
                if(err.code === 'ENOENT'){
                    await this.saveData(defaultData);
                    return defaultData;
                }
            }

        }catch(err){
            console.error('DataLoad Fail:', err);
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