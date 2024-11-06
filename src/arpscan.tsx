import { List, showToast, Toast, getPreferenceValues, ActionPanel, Action, openCommandPreferences } from "@raycast/api";
import { execa, ExecaError } from "execa";
import { useEffect, useState } from "react";

interface Preferences {
  interfaceName: string;
}
const preferences: Preferences = getPreferenceValues<Preferences>();

export interface Host {
  index: number;
  ipAddress: string;
  macAddress: string;
  name: string;
  rtt: string;
  vendor: string;
}

export async function listHosts(interfaceName: string, netmasks: string[]): Promise<Host[]> {
  try {
    const commandArguments = [
      "/opt/homebrew/bin/arp-scan",
      `--interface=${interfaceName}`,
      "--resolve",
      "--rtt",
      "--plain",
      "--format=${ip}\\t${mac}\\t${name}\\t${rtt}\\t${vendor}",
      ...netmasks,
    ];
    console.log(commandArguments.join(" "));
    console.log(commandArguments);
    const { stdout } = await execa("sudo", commandArguments);
    let index = 0;
    return stdout.split("\n").map((row) => {
      const parts = row.split("\t");
      return {
        index: index++,
        ipAddress: parts[0],
        macAddress: parts[1],
        hostName: parts[2],
        rtt: parts[3],
        vendor: parts[4],
      };
    });
  } catch (error) {
    console.log(error);
    if (error instanceof ExecaError) {
      console.error(error.stderr); // true
    }
    return [];
  }
}

export async function getAddress(_interface: string): Promise<string[]> {
  try {
    const { stdout } = await execa("/sbin/ifconfig", [_interface]);

    return stdout
      .split("\n")
      .filter((str) => str.includes("inet "))
      .map((line) => line.replace("\t", "").split(" ")[5].replace(/.255$/, ".0") + "/24");
  } catch (error) {
    console.error(error); // true
    if (error instanceof ExecaError) {
      console.error(error.stderr); // true
    }
    return [];
  }
}

const hostSorter = (a: Host, b: Host) => {
  return (
    Number(
      a.ipAddress
        .split(".")
        .map((num) => `000${num}`.slice(-3))
        .join(""),
    ) -
    Number(
      b.ipAddress
        .split(".")
        .map((num) => `000${num}`.slice(-3))
        .join(""),
    )
  );
};

export default function Command() {
  const [hosts, setHosts] = useState<Host[]>([]);
  const [netmasks, setNetmasks] = useState<string[]>([]);

  useEffect(() => {
    const fetchAndSetNetmask = async () => {
      setNetmasks(await getAddress(preferences.interfaceName));
    };
    fetchAndSetNetmask().then();
  }, []);

  useEffect(() => {
    const fetchAndSetHosts = async () => {
      if (netmasks.length === 0) {
        return;
      }
      try {
        const hosts1 = await listHosts(preferences.interfaceName, netmasks);
        setHosts(hosts1.sort(hostSorter));
      } catch (error) {
        await showToast({ style: Toast.Style.Failure, title: String(error) });
      }
    };
    fetchAndSetHosts().then();
  }, [netmasks]);

  return (
    <List
      actions={
        <ActionPanel>
          <Action title="Open Extension Preferences" onAction={openCommandPreferences} />
        </ActionPanel>
      }
    >
      {hosts.length === 0 && <List.EmptyView title="arpscan is running" />}
      {hosts.map((host) => (
        <List.Item
          key={`${host.macAddress}-${host.ipAddress}-${host.index}`}
          title={host.ipAddress}
          keywords={[host.name, host.ipAddress, host.macAddress, host.vendor].filter((value) => value)}
          accessories={[
            {
              text: host.name,
            },
            {
              tag: host.vendor,
            },
            {
              text: host.rtt,
            },
            {
              text: host.macAddress,
            },
          ]}
        />
      ))}
    </List>
  );
}
