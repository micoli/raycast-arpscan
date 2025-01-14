import {
  List,
  showToast,
  Toast,
  getPreferenceValues,
  ActionPanel,
  Action,
  openCommandPreferences,
  Clipboard,
} from "@raycast/api";

import { execa, ExecaError } from "execa";
import { useEffect, useState } from "react";

interface Preferences {
  arpscanBinary: string;
  interfaceName: string;
}

const preferences: Preferences = getPreferenceValues<Preferences>();

export interface Host {
  index: number;
  ipAddress: string;
  macAddress: string;
  name: string;
  rtt: number;
  vendor: string;
}

export async function listHosts(interfaceName: string): Promise<Host[]> {
  try {
    const commandArguments = [
      preferences.arpscanBinary,
      `--interface=${interfaceName}`,
      "--resolve",
      "--rtt",
      "--plain",
      "--format=${ip}\\t${mac}\\t${name}\\t${rtt}\\t${vendor}",
      "--localnet",
      "--ignoredups",
    ];

    const { stdout } = await execa("sudo", commandArguments);
    return stdout
      .split("\n")
      .map((row) => {
        const parts = row.split("\t");
        return {
          ipAddress: parts[0],
          macAddress: parts[1],
          name: parts[0] === parts[2] ? null : parts[2],
          rtt: parts[3],
          vendor: parts[4],
        };
      })
      .sort(hostSorter);
  } catch (error) {
    console.log(error);
    if (error instanceof ExecaError) {
      console.error(error.stderr); // true
    }
    return [];
  }
}

const hostSorter = (a: Host, b: Host) => {
  const formatIp = (ipAddress: string) => {
    return Number(
      ipAddress
        .split(".")
        .map((num) => `000${num}`.slice(-3))
        .join(""),
    );
  };

  return formatIp(a.ipAddress) - formatIp(b.ipAddress);
};

const formatNumber = (bytes, decimals) => {
  if (bytes == 0) return "0";
  const k = 1024,
    dm = decimals || 2,
    sizes = ["", "K", "M", "G", "T", "P", "E", "Z", "Y"],
    i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

export default function Command() {
  const [hosts, setHosts] = useState<Host[]>([]);
  const [filteredHosts, setFilteredHosts] = useState<Host[]>([]);
  const [filter, setFilter] = useState<string>("");

  const filterList = (_hosts: Host[], searchString: string) => {
    setFilteredHosts(
      _hosts.filter((host) =>
        [host.name, host.ipAddress, host.macAddress, host.vendor].join(" ").toLocaleLowerCase().includes(searchString),
      ),
    );
  };

  useEffect(() => {
    const fetchAndSetHosts = async () => {
      try {
        const hosts1 = await listHosts(preferences.interfaceName);
        setHosts(hosts1);
      } catch (error) {
        await showToast({ style: Toast.Style.Failure, title: String(error) });
      }
    };
    fetchAndSetHosts().then();
  }, []);

  useEffect(() => {
    filterList(hosts, filter.toLocaleLowerCase());
  }, [filter, hosts]);

  return (
    <List
      onSearchTextChange={setFilter}
      searchBarPlaceholder="Search on results"
      actions={
        <ActionPanel>
          <Action title="Open Extension Preferences" onAction={openCommandPreferences} />
        </ActionPanel>
      }
    >
      {filteredHosts.length === 0 && <List.EmptyView title="arpscan is running" />}
      {filteredHosts.map((host) => (
        <List.Item
          key={`${host.macAddress}-${host.ipAddress}`}
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
              text: formatNumber(host.rtt, 2),
            },
            {
              text: host.macAddress,
            },
          ]}
          actions={
            <ActionPanel>
              <Action title="Copy Ip Address" onAction={() => Clipboard.copy(host.ipAddress)} />
              <Action title="Copy Mac Address" onAction={() => Clipboard.copy(host.macAddress)} />
              <Action title="Copy Vendor" onAction={() => Clipboard.copy(host.vendor)} />
              <Action title="Open Extension Preferences" onAction={openCommandPreferences} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
