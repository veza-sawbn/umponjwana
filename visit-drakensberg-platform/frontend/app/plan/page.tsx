import PlanContent from './PlanContent'

// Title, description and canonical come from app/plan/layout.tsx. This page
// used to set its own title with " | Visit Drakensberg" already on the end,
// which the root title template then suffixed a second time.
export default function PlanPage() {
  return <PlanContent />
}
