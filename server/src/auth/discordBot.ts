import { Client, GatewayIntentBits } from "discord.js";
import { env } from "../env.js";

/**
 * Der Bot wird gebraucht, um beim Login die Discord-Rollen eines Benutzers aufzulösen —
 * sonst nirgends. Er meldet sich deshalb erst beim ersten Bedarf an, nicht beim Start des
 * Servers.
 *
 * gta-map macht das andersherum und beendet den Prozess, wenn die Anmeldung scheitert.
 * Das heißt: eine Discord-Störung legt auch die reine Bestandsansicht lahm. Hier bleibt
 * der Server stattdessen erreichbar, und getMemberRoles liefert null — wer sich während
 * der Störung anmeldet, bekommt keine Adminrechte. Fehlende Rechte sind die sichere
 * Richtung; ein toter Server ist es nicht.
 */
let connection: Promise<Client> | null = null;

function connect(): Promise<Client> {
  if (!connection) {
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    connection = client
      .login(env.DISCORD_BOT_TOKEN)
      .then(() => {
        console.log("Discord-Bot angemeldet.");
        return client;
      })
      .catch((error) => {
        // Nicht dauerhaft merken: beim nächsten Login-Versuch wird es erneut probiert.
        connection = null;
        throw error;
      });
  }
  return connection;
}

/** Rollen-IDs des Mitglieds; null, wenn es nicht in der Guild ist oder Discord nicht antwortet. */
export async function getMemberRoles(userId: string): Promise<string[] | null> {
  try {
    const client = await connect();
    const guild = await client.guilds.fetch(env.DISCORD_GUILD_ID);
    const member = await guild.members.fetch(userId);
    return [...member.roles.cache.keys()];
  } catch (error) {
    console.error("Discord-Rollen konnten nicht gelesen werden:", error);
    return null;
  }
}
