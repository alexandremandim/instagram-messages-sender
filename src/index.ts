import {IgApiClient} from 'instagram-private-api'
import {MediaCommentsFeedResponseCommentsItem} from 'instagram-private-api/dist/responses'
import { StorageFile } from "./storage/storage-file";
import {IgWrapper} from "./ig-api-wrapper/ig-wrapper"
import {Utils} from "./utilities/utilities"
import { readFileSync, writeFileSync, appendFileSync } from 'fs';
import { textChangeRangeIsUnchanged } from 'typescript';

(async () => {

    //await raffle()

    // Get users that we already sent message, so we don't send again
    let usersAlreadySent = new Set<number>()
    let filename = "./users_msgs.json"
    usersAlreadySent = StorageFile.loadFromFileSync(filename) // Load fom general file

    // Read config File
    let data = readFileSync("./config/config.json")
    let configFile = JSON.parse(data.toString())

    const myUserName_shop = configFile['myUserName_shop']
    const myPassword_shop = configFile['myPassword_shop']
    const myUserName_sender = configFile['myUserName_sender']
    const myPassword_sender = configFile['myPassword_sender']
    const myUserName_searcher = configFile['myUserName_searcher']
    const myPassword_searcher = configFile['myPassword_searcher']
    const target_account = configFile['targetAccount']

    
    // Login Shop Account
    process.env.IG_USERNAME = myUserName_shop
    process.env.IG_PASSWORD = myPassword_shop
    const igShop = new IgApiClient();
    const wrapperShop = new IgWrapper(igShop, myUserName_shop)
    await wrapperShop.login()
    usersAlreadySent = await StorageFile.loadFromServer(myUserName_shop, igShop, usersAlreadySent)

    // Login Sender
    process.env.IG_USERNAME = myUserName_sender
    process.env.IG_PASSWORD = myPassword_sender
    const igSender = new IgApiClient();
    const wrapperSender = new IgWrapper(igSender, myUserName_sender)
    await wrapperSender.login()
    usersAlreadySent = await StorageFile.loadFromServer(myUserName_sender, igSender, usersAlreadySent)


    // Login Searcher
    process.env.IG_USERNAME = myUserName_searcher
    process.env.IG_PASSWORD = myPassword_searcher
    const igSearcher = new IgApiClient();
    const wrapperSearcher = new IgWrapper(igSearcher, myUserName_searcher)
    await wrapperSearcher.login()
    

    let statistics = { msgsSended : 0};

    // Handle kill signals
    process.once('SIGINT', async function (code) {
        console.log('Received SIGINT\nSaving messages list')
        console.log("Sent " + statistics.msgsSended + " messages")
        StorageFile.saveFile(filename, usersAlreadySent)
        await wrapperShop.logout()
        await wrapperSearcher.logout()
        await wrapperSender.logout()
        process.exit(1)
    });
    process.once('SIGTERM', async function (code) {
        console.log('Received SIGTERM\nSaving messages list')
        console.log("Sent " + statistics.msgsSended + " messages")
        StorageFile.saveFile(filename, usersAlreadySent)
        await wrapperShop.logout()
        await wrapperSearcher.logout()
        await wrapperSender.logout()
        process.exit(1)
    });
    
    try{
        // Algorithm
        console.log('Exploring account ' + target_account)
        sendingDirectsByAccount(statistics, await wrapperSearcher.getUserPk(target_account),
            igSearcher, wrapperSender, usersAlreadySent, configFile)
    }
    catch(e){
        console.log(e)
    }
    finally{
        StorageFile.saveFile(filename, usersAlreadySent)
    }
})();

async function sendingDirectsByAccount(statistics : {msgsSended: number}, 
    targetId: number, igSearcher: IgApiClient, igWrapper: IgWrapper,
    usersAlreadySent: Set<number>, configFile: any)
{
    let userFeed = igSearcher.feed.user(targetId), nrMaxPubs = 20, pubsAnalysed = 0, directsSended = 0
        do{
            let accountFeedItems = await userFeed.items()
            // Publications
            for (let post of accountFeedItems){
                console.log('A analisar a publicação ' + post.pk)
                let allComments = await igSearcher.feed.mediaComments(post.pk).items()
                // Comments
                for (let comment of allComments){
                    if(!IgWrapper.checkIfWeAlreadySentDirect(comment.user.pk, usersAlreadySent)){
                        await igWrapper.sendDirect(Utils.createGiveAwayMessage(configFile), comment.user.pk,usersAlreadySent)
                        statistics.msgsSended++
                        await Utils.waiting()
                    }
                }

                // Likes
                let pubLikers = await igSearcher.media.likers(post.pk)
                for (let user of pubLikers.users){
                    if(!IgWrapper.checkIfWeAlreadySentDirect(user.pk, usersAlreadySent)){
                        await igWrapper.sendDirect(Utils.createGiveAwayMessage(configFile), user.pk,usersAlreadySent)
                        statistics.msgsSended++
                        await Utils.waiting()
                    }
                }
            }
            pubsAnalysed++
        }while(userFeed.isMoreAvailable() && pubsAnalysed < nrMaxPubs)

        console.log("Terminated publications - " + pubsAnalysed)

        console.log("\n\nAnalysing account followers.\n\n");
        await Utils.waiting(50,60)

        let accountFollowers = igSearcher.feed.accountFollowers(targetId)
        // Account followers
        do{
            let accountFollowersItems = await accountFollowers.items()
            for (let follower of accountFollowersItems){
                if(!IgWrapper.checkIfWeAlreadySentDirect(follower.pk, usersAlreadySent)){
                    await igWrapper.sendDirect(Utils.createGiveAwayMessage(configFile), follower.pk,usersAlreadySent)
                    statistics.msgsSended++
                    await Utils.waiting()
                }
            }
        }while(accountFollowers.isMoreAvailable())
}

async function getPostID(code: string) {
    process.env.IG_USERNAME = ''
    process.env.IG_PASSWORD = ''
    const ig = new IgApiClient();
    let igWrapper = new IgWrapper(ig, process.env.IG_USERNAME)
    await igWrapper.login()

    let userFeed = ig.feed.user(igWrapper.myPk)
    do{
        let accountFeedItems = await userFeed.items()
        for (let post of accountFeedItems){
            if(post.code == code){
                return post.pk
            }
        }
    }while(userFeed.isMoreAvailable())
    
    return -1
}

async function raffle() {
    process.env.IG_USERNAME = ''
    process.env.IG_PASSWORD = ''
    // Login
    const ig = new IgApiClient();
    let igWrapper = new IgWrapper(ig, process.env.IG_USERNAME)
    await igWrapper.login()

    let pub_id = -1 // INSERT publication ID

    // Get publication comments
    let comment = ig.feed.mediaComments(String(pub_id))
    let filename = './raffle.txt'
    let all_comments = Array<MediaCommentsFeedResponseCommentsItem>()
    writeFileSync(filename,'comment_pk\tcomment_text\tuser_full_name\tuser_username\tuser_pk\n', 'utf8')
    // Get all comments
    do{
        let comments = await comment.items()
        all_comments = all_comments.concat(comments)
    
    }while(comment.isMoreAvailable())
    // Write accounts that commented in publication into txt file
    console.log('Total: ' + all_comments.length)
    for(let c of all_comments)
    {
        appendFileSync(filename, c.pk+'\t'+c.text+'\t'+c.user.full_name+'\t'+c.user.username+'\t'+c.user.pk+'\n', 'utf8')
    }    
}