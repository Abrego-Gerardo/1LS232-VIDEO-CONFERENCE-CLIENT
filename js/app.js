
const App = {
    mode: "light",
    view: "call",
    
    userName: null,
    room: null,
    roomName: null,

  

    video: true, 
    audio: true,



    message: "",

    users: [],
    streamList: [],
    chats: [],
    files: [],
    notes: [],

    CallActions: new CallActions(),

    toggleMode() {
        if (this.mode == "light") {
            this.mode = "dark";
        } else {
            this.mode = "light";
        }
    },
    async accessRoom() {
        let self = this;
        this.room = this.roomName;
        this.roomName = null;


        try {
            this.notes = await NotesHelper.getList(this.room);
        } catch (error) {
            console.error('Error fetching notes:', error);
            this.notes = []; 
        }

        await AblyHelper.connect(this.room, (message) => {
            console.log('Received a message in realtime: ' + message.data)
            var json = JSON.parse(message.data);
            switch (json.action) { 
                case "user":         
                    if (
                        json.streamId != ApiRTCHelper.localStream.publishedInConversations.get(this.room) &&
                        !this.streamList.find(stream => stream.streamId == json.streamId)                        
                    ) {
                        this.streamList.push(json);
                    }      
                    break;
                case "chat":
                    self.chats.push(json);
                    break;
                case "file":
                    self.chats.push(json); 
                    self.files.push(json.file);
                    break
            }
        });

        await ApiRTCHelper.connect(
            this.room,
            async (stream) => {              
                await AblyHelper.send({ 
                    action: "user", 
                    user: this.userName, 
                    streamId: ApiRTCHelper.localStream.publishedInConversations.get(this.room) 
                });  
            },
            (stream) => {
                this.streamList = this.streamList.filter(x => x.streamId != stream.streamId);
            }
        );
    },
    async sendMessage() {
        await this.sendChat({
            "action": "chat",
            "message": this.message,            
        });
        this.message = '';
    },

    async sendChat(chat) {
        chat.sender = {
            "name": this.userName,
            "picture": "images/avatar.jpeg"
        }
        chat.room = this.room;
        await AblyHelper.send(chat);

        //almacenando el chat 
        await DatabaseHelper.saveChat(chat);
    },
 
    toggleAudio() {
        this.audio = !this.audio;
        ApiRTCHelper.toggleAudio();
    },
    toggleVideo() {
        this.video = !this.video; 
        ApiRTCHelper.toggleVideo();
    },

    async leaveConversation(prompt) {
        if (prompt) {
            const exit = confirm('Da ok, si deseas salir de la sesion')
            if (!exit) {
                return false;
            }
        }

        await this.CallActions.leaveConversation();
        this.files = [];
        this.chats = [];
        this.notes = [];
        this.room = null;
        this.userName = null;
    },

    upload(file){
        const path = `${this.room}/${file.name}`
        const result = StorageHelper.upload(file, path)
        if(result) {
            this.sendChat({
                "action": "file",
                "file": path
            })
        }
    }

};

document.addEventListener('alpine:init', () => {
    Alpine.data('App', () => (App))
});

window.ondragover = function (event) {
    event.preventDefault();
};

window.ondrop = async function (event) {
    event.preventDefault();
    const files = event.dataTransfer.files;
    for (const file of files) {
        App.upload(file)
    }
};

firebase.initializeApp(CONFIG.Firebase);

