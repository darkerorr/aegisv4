import { MarketingNav } from "@/components/navigation/marketing-nav";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
export default function MarketingLayout({children}:{children:React.ReactNode}){return <><MarketingNav/>{children}<MarketingFooter/></>}
