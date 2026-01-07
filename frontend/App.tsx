import { useWallet } from "@aptos-labs/wallet-adapter-react";
// Internal Components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { TopBanner } from "@/components/TopBanner";
import { UserPositions } from "@/components/UserPositions";
import { UserLocks } from "./components/UserLocks";

function App() {
  const { connected } = useWallet();

  return (
    <>
      <TopBanner />
      <Header />
      <div className="flex items-center justify-center flex-col">
        {connected ? (
          <Card>
            <CardContent className="flex flex-col gap-10 pt-6">
              <UserPositions />
              <UserLocks />
              {/* <WalletDetails /> */}
              {/* <NetworkInfo />
              <AccountInfo />
              <TransferAPT />
              <MessageBoard /> */}
            </CardContent>
          </Card>
        ) : (
          <CardHeader>
            <CardTitle>To get started Connect a wallet</CardTitle>
          </CardHeader>
        )}
      </div>
    </>
  );
}

export default App;
