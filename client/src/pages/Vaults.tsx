import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, Lock, TrendingUp, DollarSign, Clock, ArrowUpRight, ArrowDownRight, Search, Filter, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Vault {
  id: string;
  name: string;
  leader: string;
  apr: number;
  tvl: number;
  yourDeposit: number;
  age: number;
  type: "protocol" | "user";
  isActive: boolean;
}

const protocolVaults: Vault[] = [
  {
    id: "1",
    name: "Hyperliquidity Provider (HLP)",
    leader: "0x677d...84e7",
    apr: 106.53,
    tvl: 588543274.33,
    yourDeposit: 0,
    age: 901,
    type: "protocol",
    isActive: true
  },
  {
    id: "2",
    name: "Liquidator",
    leader: "0xfc13...80c9",
    apr: -0.00,
    tvl: 16031.77,
    yourDeposit: 0,
    age: 968,
    type: "protocol",
    isActive: true
  }
];

const userVaults: Vault[] = [
  {
    id: "3",
    name: "AceVault Hyper01",
    leader: "0x1a2b...3c4d",
    apr: 111.29,
    tvl: 14125554.20,
    yourDeposit: 0,
    age: 64,
    type: "user",
    isActive: true
  },
  {
    id: "4",
    name: "Growi HF",
    leader: "0x5e6f...7g8h",
    apr: 196.01,
    tvl: 5472052.76,
    yourDeposit: 0,
    age: 470,
    type: "user",
    isActive: true
  },
  {
    id: "5",
    name: "[ Systemic Strategies ] L/S Grids",
    leader: "0x9i0j...1k2l",
    apr: 50.50,
    tvl: 4058620.11,
    yourDeposit: 0,
    age: 271,
    type: "user",
    isActive: true
  },
  {
    id: "6",
    name: "FC Genesis - Quantum",
    leader: "0x3m4n...5o6p",
    apr: -1.00,
    tvl: 2669444.19,
    yourDeposit: 0,
    age: 39,
    type: "user",
    isActive: true
  },
  {
    id: "7",
    name: "Amber Ridge",
    leader: "0x7q8r...9s0t",
    apr: 81.35,
    tvl: 2472602.62,
    yourDeposit: 0,
    age: 117,
    type: "user",
    isActive: true
  },
  {
    id: "8",
    name: "MC Recovery Fund",
    leader: "0x1u2v...3w4x",
    apr: -4.79,
    tvl: 2209355.07,
    yourDeposit: 0,
    age: 72,
    type: "user",
    isActive: true
  },
  {
    id: "9",
    name: "[ Systemic Strategies ] ∞ HyperGrowth ∞",
    leader: "0x5y6z...7a8b",
    apr: -20.09,
    tvl: 2194112.15,
    yourDeposit: 0,
    age: 53,
    type: "user",
    isActive: true
  },
  {
    id: "10",
    name: "Sifu",
    leader: "0x9c0d...1e2f",
    apr: -27.87,
    tvl: 2009660.29,
    yourDeposit: 0,
    age: 675,
    type: "user",
    isActive: true
  },
  {
    id: "11",
    name: "Bitcoin Moving Average Long/Short",
    leader: "0x3g4h...5i6j",
    apr: -14.55,
    tvl: 1471861.72,
    yourDeposit: 0,
    age: 20,
    type: "user",
    isActive: true
  },
  {
    id: "12",
    name: "FH Growth",
    leader: "0x7k8l...9m0n",
    apr: 317.02,
    tvl: 1272802.05,
    yourDeposit: 0,
    age: 40,
    type: "user",
    isActive: true
  }
];

export default function Vaults() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [timeFilter, setTimeFilter] = useState("30D");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const allVaults = [...protocolVaults, ...userVaults];
  const totalTVL = allVaults.reduce((sum, vault) => sum + vault.tvl, 0);

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
    }
    return `$${amount.toFixed(2)}`;
  };

  const formatAPR = (apr: number) => {
    const sign = apr >= 0 ? "+" : "";
    return `${sign}${apr.toFixed(2)}%`;
  };

  const getAPRColor = (apr: number) => {
    return apr >= 0 ? "text-green-400" : "text-red-400";
  };

  const filteredVaults = allVaults.filter(vault => {
    const matchesSearch = vault.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vault.leader.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === "all" || 
                               (filterType === "leading" && vault.type === "protocol") ||
                               (filterType === "deposited" && vault.yourDeposit > 0) ||
                               (filterType === "others" && vault.type === "user" && vault.yourDeposit === 0);
    return matchesSearch && matchesFilter;
  });

  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedVaults = filteredVaults.slice(startIndex, endIndex);
  const totalPages = Math.ceil(filteredVaults.length / rowsPerPage);

  const MiniChart = ({ apr }: { apr: number }) => {
    const isPositive = apr >= 0;
    const height = Math.min(Math.abs(apr) / 10, 20); // Scale to max 20px height
    
    return (
      <div className="flex items-end h-6 w-16">
        <div className="flex-1 flex items-end">
          <div 
            className={`w-1 ${isPositive ? 'bg-green-400' : 'bg-red-400'} rounded-sm`}
            style={{ height: `${height}px` }}
          />
          <div 
            className={`w-1 ml-1 ${isPositive ? 'bg-green-400' : 'bg-red-400'} rounded-sm`}
            style={{ height: `${height * 0.8}px` }}
          />
          <div 
            className={`w-1 ml-1 ${isPositive ? 'bg-green-400' : 'bg-red-400'} rounded-sm`}
            style={{ height: `${height * 1.2}px` }}
          />
          <div 
            className={`w-1 ml-1 ${isPositive ? 'bg-green-400' : 'bg-red-400'} rounded-sm`}
            style={{ height: `${height * 0.6}px` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">Vaults</h1>
              <div className="bg-card/50 border border-border/30 rounded-lg p-4 inline-block">
                <p className="text-sm text-muted-foreground">Total Value Locked</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(totalTVL)}</p>
              </div>
            </div>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Connect
            </Button>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search by vault address, name or leader..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-card/50 border-border/30"
              />
            </div>
            <div className="flex gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-48 bg-card/50 border-border/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vaults</SelectItem>
                  <SelectItem value="leading">Leading</SelectItem>
                  <SelectItem value="deposited">Deposited</SelectItem>
                  <SelectItem value="others">Others</SelectItem>
                </SelectContent>
              </Select>
              <Select value={timeFilter} onValueChange={setTimeFilter}>
                <SelectTrigger className="w-20 bg-card/50 border-border/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7D">7D</SelectItem>
                  <SelectItem value="30D">30D</SelectItem>
                  <SelectItem value="90D">90D</SelectItem>
                  <SelectItem value="1Y">1Y</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Protocol Vaults */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-bold mb-6 text-foreground">Protocol Vaults</h2>
        <Card className="bg-card/50 border-border/30">
          <Table>
            <TableHeader>
              <TableRow className="border-border/30">
                <TableHead className="text-foreground">Vault</TableHead>
                <TableHead className="text-foreground">Leader</TableHead>
                <TableHead className="text-foreground">APR</TableHead>
                <TableHead className="text-foreground">TVL</TableHead>
                <TableHead className="text-foreground">Your Deposit</TableHead>
                <TableHead className="text-foreground">Age (days)</TableHead>
                <TableHead className="text-foreground">Snapshot</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {protocolVaults.map((vault) => (
                <TableRow key={vault.id} className="border-border/30 hover:bg-muted/20">
                  <TableCell className="font-medium text-foreground">{vault.name}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-sm">{vault.leader}</TableCell>
                  <TableCell>
                    <span className={getAPRColor(vault.apr)}>
                      {formatAPR(vault.apr)}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-foreground">{formatCurrency(vault.tvl)}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {formatCurrency(vault.yourDeposit)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{vault.age}</TableCell>
                  <TableCell>
                    <MiniChart apr={vault.apr} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* User Vaults */}
        <h2 className="text-2xl font-bold mb-6 mt-12 text-foreground">User Vaults</h2>
        <Card className="bg-card/50 border-border/30">
          <Table>
            <TableHeader>
              <TableRow className="border-border/30">
                <TableHead className="text-foreground">Vault</TableHead>
                <TableHead className="text-foreground">Leader</TableHead>
                <TableHead className="text-foreground">APR</TableHead>
                <TableHead className="text-foreground">TVL</TableHead>
                <TableHead className="text-foreground">Your Deposit</TableHead>
                <TableHead className="text-foreground">Age (days)</TableHead>
                <TableHead className="text-foreground">Snapshot</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedVaults.filter(vault => vault.type === "user").map((vault) => (
                <TableRow key={vault.id} className="border-border/30 hover:bg-muted/20">
                  <TableCell className="font-medium text-foreground">{vault.name}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-sm">{vault.leader}</TableCell>
                  <TableCell>
                    <span className={getAPRColor(vault.apr)}>
                      {formatAPR(vault.apr)}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-foreground">{formatCurrency(vault.tvl)}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {formatCurrency(vault.yourDeposit)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{vault.age}</TableCell>
                  <TableCell>
                    <MiniChart apr={vault.apr} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page:</span>
            <Select value={rowsPerPage.toString()} onValueChange={(value) => setRowsPerPage(Number(value))}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {startIndex + 1}-{Math.min(endIndex, filteredVaults.length)} of {filteredVaults.length}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
