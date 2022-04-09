import { IgApiClient, IgExactUserNotFoundError } from "instagram-private-api";
import { Utils } from "../utilities/utilities";

export class IgWrapper{
    ig : IgApiClient;
    myPk: number;
    myUsername: string;

    constructor(ig: IgApiClient, myUsername: string) {
        this.ig = ig
        this.myPk = -1
        this.myUsername = myUsername
    }

    async sendDirect(message: string, messageReceiverPk: number, allUsers: Set<number>){
        console.log('Sending message to ' + messageReceiverPk)
        try{
            const thread = this.ig.entity.directThread([messageReceiverPk.toString()]);
            await thread.broadcastText(message)
            return allUsers.add(messageReceiverPk)
        }
        catch (ex){
            console.log('Aconteceu um erro tentar enviar a mensagem. Possivelmente estamos a sobrecarregar o instagram. Detalhes do erro:\n')
            console.log(ex.response.body)
            console.log('O programa vai encerrar. Tentar mais tarde.')
            process.kill(process.pid, "SIGINT")
        }
    }

    static checkIfWeAlreadySentDirect(userPk: number, allUsers: Set<number>){
        if(allUsers.has(userPk)){
            return true
        } 
        return false;
    }

    async login(){
        this.ig.state.generateDevice(process.env.IG_USERNAME!);
        await this.ig.simulate.preLoginFlow()
        await this.ig.account.login(process.env.IG_USERNAME!, process.env.IG_PASSWORD!);
        this.myPk = await this.getUserPk(this.myUsername)
    }

    async logout(){
        await this.ig.account.logout()
    }

    async getUserPk(username: string){
        try{
            return await this.ig.user.getIdByUsername(username)
        }
        catch(e){
            if (e instanceof(IgExactUserNotFoundError)){
                console.log('Este cabrao bloqueou-me.')
                return -1
            }
            else{
                console.log(e)
                return -1
            }
        }
    }

    async sendFollowingRequest(userPk: number){
        let friendsip = await this.ig.friendship.show(userPk)
        if (friendsip.blocking == true || friendsip.followed_by == true 
            || friendsip.outgoing_request == true)
            return

        console.log('Sending following request to ' + userPk)
        await this.ig.friendship.create(userPk)
    }

    async removeFollowing(userPk: number){
        await this.ig.friendship.destroy(userPk)
    }

    async checkIfImBlocked(userPk: number){
        let friendsip = await this.ig.friendship.show(userPk)
        console.log(friendsip)
    }
}