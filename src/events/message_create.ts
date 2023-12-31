import {ChannelType, Client, ForumChannel, Locale, TextChannel, ThreadChannel, userMention} from "discord.js";
import moment from "moment";

import { deleteAfter } from "../commands";
import { COMMENT_REGEX, parseResult, roll } from "../dice";
import { Resultat } from "../interface";
import { ln } from "../localizations";
import { findForumChannel, findThread } from "../utils";


export const DETECT_DICE_MESSAGE = /([\w\.]+|(\{.*\})) (.*)/;

export default (client: Client): void => {
	client.on("messageCreate", async (message) => {
		if (message.author.bot) return;
		if (message.channel.type === ChannelType.DM) return;
		if (!message.guild) return;
		let content = message.content;
		//detect roll between bracket
		const detectRoll = content.match(/\[(.*)\]/)?.[1];
		const rollWithMessage = content.match(DETECT_DICE_MESSAGE)?.[3];
		if (rollWithMessage && !detectRoll) {
			const diceValue = content.match(/^\S*#?d\S+|\{.*\}/);
			if (!diceValue) return;
			content = content.replace(DETECT_DICE_MESSAGE, "$1 /* $3 */");
		}
		let deleteInput=true;
		let result: Resultat| undefined;
		try {
			result = detectRoll ? roll(detectRoll) : roll(content);
		} catch(e) {
			return;
		}
		if (detectRoll) {
			deleteInput = false;
		}
		//is a valid roll as we are in the function so we can work as always

		const userLang = message.guild.preferredLocale ?? Locale.EnglishUS;
		const translation = ln(userLang);
		const channel = message.channel;
		if (!result) return;
		const parser = parseResult(result, translation);

		if (channel instanceof TextChannel && channel.name.startsWith("🎲")) {
			await message.reply({content: parser, allowedMentions: { repliedUser: false }});
			return;
		}
		if (channel instanceof TextChannel || (channel.parent instanceof ForumChannel && !channel.name.startsWith("🎲"))) {
			let linkToOriginal = "";
			if (deleteInput) {
				message.delete();
			} else {
				linkToOriginal = `\n\n__Original__: ${message.url}`;
			}
			const thread = channel instanceof TextChannel ? await findThread(channel, translation.roll.reason) : await findForumChannel(channel.parent as ForumChannel, translation.roll.reason, channel as ThreadChannel);
			const msgToEdit = await thread.send("_ _");
			const signMessage = result.compare ? `${result.compare.sign} ${result.compare.value}` : "";
			const authorMention = `*${userMention(message.author.id)}* (🎲 \`${result.dice.replace(COMMENT_REGEX, "")} ${signMessage}\`)`;
			const msg = `${authorMention} - <t:${moment().unix()}>\n${parser}${linkToOriginal}`;
			await msgToEdit.edit(msg);
			const idMessage = `↪ ${msgToEdit.url}`;
			const reply = deleteInput ?
				await channel.send({ content: `${authorMention}\n${parser}\n\n${idMessage}` })
				: await message.reply({ content: `${parser}\n\n${idMessage}` , allowedMentions: { repliedUser: false }});
			deleteAfter(reply, 180000);
			return;
		}
		await message.reply({content: parser, allowedMentions: { repliedUser: false }});
	});
};