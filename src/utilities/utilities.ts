export class Utils{
    static createMessage(){
        let saudacao = new Array<string>()
        saudacao.push('Greeting example 1')
        saudacao.push('Greeting example 2')

        let corpo_texto = new Array<string>()
        corpo_texto.push("Message Body 1")
        corpo_texto.push("Message Body 2")

        return saudacao[Math.floor(Math.random() * saudacao.length)] + "\n" + corpo_texto[Math.floor(Math.random() * corpo_texto.length)]
    }

    static async waiting(min: number = 8, max: number = 15){
        let seconds_wait = (Math.floor(Math.random() * (max-min)) + min )
        await new Promise(r => setTimeout(r, seconds_wait * 1000));
    }

    static createGiveAwayMessage(configFile: any){
        return configFile['message']
    }
}