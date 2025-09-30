import { ChevronLeft, ChevronRight } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "../ui/button"

interface DocsPaginationProps {
  prevPage?: {
    title: string
    href: string
  } | null
  nextPage?: {
    title: string
    href: string
  } | null
  onNavigate?: (path: string) => void
}

export function DocsPagination({ prevPage, nextPage, onNavigate }: DocsPaginationProps) {
  const handleNavigation = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate(href);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row justify-between gap-4 pt-8">
      {prevPage ? (
        <Link to={prevPage.href} onClick={(e) => handleNavigation(e, prevPage.href)} className="group pt-1">
          <Button variant="ghost" className="w-full sm:w-auto justify-start group-hover:bg-[#5d43ef]/20 transition-colors">
            <ChevronLeft className="mr-2 h-4 w-4 text-[#8B5CF6] group-hover:text-[#5D43EF] transition-colors" />
            <div className="text-left">
              <div className="text-xs text-[#8B5CF6] group-hover:text-[#5D43EF] transition-colors">Previous</div>
              <div className="font-medium text-[#8B5CF6] group-hover:text-[#5D43EF] transition-colors">{prevPage.title}</div>
            </div>
          </Button>
        </Link>
      ) : (
        <div />
      )}
      
      {nextPage && (
        <Link to={nextPage.href} onClick={(e) => handleNavigation(e, nextPage.href)} className="group sm:ml-auto">
          <Button variant="ghost" className="w-full sm:w-auto justify-end group-hover:bg-[#5d43ef]/20 transition-colors">
            <div className="text-right">
              <div className="text-xs text-[#8B5CF6] group-hover:text-[#5D43EF] transition-colors">Next</div>
              <div className="font-medium text-[#8B5CF6] group-hover:text-[#5D43EF] transition-colors">{nextPage.title}</div>
            </div>
            <ChevronRight className="ml-2 h-4 w-4 text-[#8B5CF6] group-hover:text-[#5D43EF] transition-colors" />
          </Button>
        </Link>
      )}
    </div>
  )
}
