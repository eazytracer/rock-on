import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ModernLayout } from '../../components/layout/ModernLayout'
import { useAuth } from '../../contexts/AuthContext'
import {
  ArrowLeft,
  Edit,
  Copy,
  Share2,
  RefreshCw,
  Search,
  MoreVertical,
  X,
  Crown,
  Shield,
  User,
  Trash2,
  UserPlus,
  UserMinus,
  AlertTriangle,
  Music2,
} from 'lucide-react'
// DATABASE INTEGRATION: Import database and hooks
import { db } from '../../services/database'
import {
  useBand,
  useBandMembers,
  useBandInviteCodes,
  useGenerateInviteCode,
  useRemoveBandMember,
  useUpdateMemberRole,
  useUpdateBand,
} from '../../hooks/useBands'

// Types
interface Instrument {
  name: string
  isPrimary?: boolean
}

interface BandMember {
  userId: string
  name: string
  email: string
  role: 'owner' | 'admin' | 'member'
  instruments: Instrument[]
  joinedDate: Date
  status: 'active' | 'inactive'
  initials: string
  avatarColor: string
  membershipId: string // DATABASE INTEGRATION: Added to track membership record
}

const instrumentPresets = [
  'Guitar',
  'Bass',
  'Drums',
  'Keyboards',
  'Vocals',
  'Harmonica',
  'Trumpet',
  'Trombone',
  'Saxophone',
  'Violin',
  'Cello',
]

// Helper function to generate initials from name
const getInitials = (name: string): string => {
  const parts = name.split(' ')
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

// Helper function to generate avatar color from user ID
const getAvatarColor = (userId: string): string => {
  const colors = [
    '#f17827',
    '#3b82f6',
    '#8b5cf6',
    '#ec4899',
    '#f59e0b',
    '#10b981',
    '#06b6d4',
  ]
  const hash = userId
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return colors[hash % colors.length]
}

export const BandMembersPage: React.FC = () => {
  const navigate = useNavigate()

  // Get auth context for user info and sign out
  const { currentUser, signOut } = useAuth()

  // DATABASE INTEGRATION: Get current band ID and user ID from localStorage
  const currentBandId = localStorage.getItem('currentBandId') || ''
  const currentUserId = localStorage.getItem('currentUserId') || ''

  // DATABASE INTEGRATION: Use database hooks
  const { band, loading: bandLoading } = useBand(currentBandId)
  const { members: dbMembers, loading: membersLoading } =
    useBandMembers(currentBandId)
  const {
    inviteCodes,
    loading: _codesLoading,
    refetch: refetchInviteCodes,
  } = useBandInviteCodes(currentBandId)
  const { generateCode } = useGenerateInviteCode()
  const { removeMember } = useRemoveBandMember()
  const { updateRole } = useUpdateMemberRole()
  const { updateBand } = useUpdateBand()

  // Local state for UI
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedCode, setCopiedCode] = useState(false)
  const [members, setMembers] = useState<BandMember[]>([])
  const [currentUserRole, setCurrentUserRole] = useState<
    'owner' | 'admin' | 'member'
  >('member')
  const [toastMessage, setToastMessage] = useState<string>('')

  // Modal states
  const [showEditBandModal, setShowEditBandModal] = useState(false)
  const [showRegenerateCodeDialog, setShowRegenerateCodeDialog] =
    useState(false)
  const [showMemberDetailModal, setShowMemberDetailModal] = useState(false)
  const [showEditInstrumentsModal, setShowEditInstrumentsModal] =
    useState(false)
  const [showRemoveMemberDialog, setShowRemoveMemberDialog] = useState(false)
  const [showTransferOwnershipDialog, setShowTransferOwnershipDialog] =
    useState(false)
  const [selectedMember, setSelectedMember] = useState<BandMember | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  // Edit states
  const [editBandName, setEditBandName] = useState('')
  const [editBandDescription, setEditBandDescription] = useState('')
  const [editInstruments, setEditInstruments] = useState<Instrument[]>([])
  const [transferConfirmText, setTransferConfirmText] = useState('')
  const [showCustomInstrumentInput, setShowCustomInstrumentInput] =
    useState(false)
  const [customInstrumentName, setCustomInstrumentName] = useState('')

  const handleSignOut = async () => {
    // signOut() now calls logout() internally to clear all state
    await signOut()
    navigate('/auth')
  }

  // DATABASE INTEGRATION: Load and transform members from database
  useEffect(() => {
    const transformMembers = async () => {
      if (!dbMembers || dbMembers.length === 0) {
        setMembers([])
        return
      }

      // Deduplicate members by userId (in case of race conditions during sync)
      const uniqueMembers = dbMembers.filter(
        (member, index, self) =>
          index ===
          self.findIndex(m => m.membership.userId === member.membership.userId)
      )

      const transformedMembers: BandMember[] = await Promise.all(
        uniqueMembers.map(
          async ({ membership, user, profile }): Promise<BandMember> => {
            // User data now comes from the hook (cloud-first), no need to query db.users

            // Convert instruments from profile
            const instruments: Instrument[] =
              profile?.instruments?.map((inst: string) => ({
                name: inst,
                isPrimary: inst === profile.primaryInstrument,
              })) || []

            // Map role: database has 'admin'|'member'|'viewer', UI needs 'owner'|'admin'|'member'
            // Check permissions array for 'owner' flag
            const isOwner = membership.permissions?.includes('owner') || false
            const role: 'owner' | 'admin' | 'member' = isOwner
              ? 'owner'
              : membership.role === 'admin'
                ? 'admin'
                : 'member'

            return {
              userId: membership.userId,
              membershipId: membership.id,
              name: profile?.displayName || user?.name || 'Unknown User',
              email: user?.email || '',
              role,
              instruments,
              joinedDate: membership.joinedDate,
              status: membership.status as 'active' | 'inactive',
              initials: getInitials(
                profile?.displayName || user?.name || 'Unknown'
              ),
              avatarColor: getAvatarColor(membership.userId),
            }
          }
        )
      )

      setMembers(transformedMembers)

      // Set current user's role
      const currentMembership = dbMembers.find(
        m => m.membership.userId === currentUserId
      )
      if (currentMembership) {
        const isOwner =
          currentMembership.membership.permissions?.includes('owner') || false
        const role: 'owner' | 'admin' | 'member' = isOwner
          ? 'owner'
          : currentMembership.membership.role === 'admin'
            ? 'admin'
            : 'member'
        setCurrentUserRole(role)
      }
    }

    transformMembers()
  }, [dbMembers, currentUserId])

  // DATABASE INTEGRATION: Update edit states when band loads
  useEffect(() => {
    if (band) {
      setEditBandName(band.name)
      setEditBandDescription(band.description || '')
    }
  }, [band])

  // Show toast helper
  const showToast = (message: string) => {
    setToastMessage(message)
    setTimeout(() => setToastMessage(''), 3000)
  }

  // Filtered members
  const filteredMembers = members.filter(
    member =>
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.instruments.some(inst =>
        inst.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
  )

  // Sort members: Owner first, then Admins, then Members alphabetically
  const sortedMembers = [...filteredMembers].sort((a, b) => {
    if (a.role === 'owner') return -1
    if (b.role === 'owner') return 1
    if (a.role === 'admin' && b.role !== 'admin') return -1
    if (b.role === 'admin' && a.role !== 'admin') return 1
    return a.name.localeCompare(b.name)
  })

  // Handlers
  const handleCopyInviteCode = async () => {
    const activeCode = inviteCodes[0]?.code
    if (activeCode) {
      await navigator.clipboard.writeText(activeCode)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    }
  }

  const handleShareInviteCode = async () => {
    const activeCode = inviteCodes[0]?.code
    if (navigator.share && band && activeCode) {
      await navigator.share({
        title: `Join ${band.name} on Rock-On`,
        text: `Join my band ${band.name} on Rock-On! Use invite code: ${activeCode}`,
      })
    }
  }

  // DATABASE INTEGRATION: Generate new invite code
  const handleRegenerateCode = async () => {
    try {
      const newCode = await generateCode(currentBandId, currentUserId)
      setShowRegenerateCodeDialog(false)
      // Refetch invite codes to update UI immediately
      await refetchInviteCodes()
      showToast(`New invite code generated: ${newCode}`)
    } catch (error) {
      console.error('Error generating invite code:', error)
      showToast('Failed to generate invite code')
    }
  }

  // DATABASE INTEGRATION: Save band info
  const handleSaveBandInfo = async () => {
    try {
      await updateBand(currentBandId, {
        name: editBandName,
        description: editBandDescription,
      })
      setShowEditBandModal(false)
      showToast('Band info updated successfully')
    } catch (error) {
      console.error('Error updating band:', error)
      showToast('Failed to update band info')
    }
  }

  // DATABASE INTEGRATION: Save instruments to user profile
  const handleSaveInstruments = async () => {
    if (!selectedMember) return

    try {
      // Get the user profile
      const profile = await db.userProfiles
        .where('userId')
        .equals(selectedMember.userId)
        .first()

      if (profile) {
        // Convert instruments back to array format
        const instrumentNames = editInstruments.map(inst => inst.name)
        const primaryInstrument = editInstruments.find(
          inst => inst.isPrimary
        )?.name

        await db.userProfiles.update(profile.id, {
          instruments: instrumentNames,
          primaryInstrument: primaryInstrument || instrumentNames[0],
          updatedDate: new Date(),
        })

        // Update local state
        const updatedMembers = members.map(m =>
          m.userId === selectedMember.userId
            ? { ...m, instruments: editInstruments }
            : m
        )
        setMembers(updatedMembers)

        setShowEditInstrumentsModal(false)
        showToast('Instruments updated successfully')
      }
    } catch (error) {
      console.error('Error updating instruments:', error)
      showToast('Failed to update instruments')
    }
  }

  // DATABASE INTEGRATION: Remove member from band
  const handleRemoveMember = async () => {
    if (!selectedMember) return

    try {
      await removeMember(selectedMember.membershipId)

      // Update local state
      setMembers(members.filter(m => m.userId !== selectedMember.userId))

      setShowRemoveMemberDialog(false)
      setSelectedMember(null)
      showToast('Member removed successfully')
    } catch (error) {
      console.error('Error removing member:', error)
      showToast('Failed to remove member')
    }
  }

  // DATABASE INTEGRATION: Make member admin
  const handleMakeAdmin = async (member: BandMember) => {
    try {
      await updateRole(member.membershipId, 'admin')

      // Update local state
      const updatedMembers = members.map(m =>
        m.userId === member.userId ? { ...m, role: 'admin' as const } : m
      )
      setMembers(updatedMembers)

      setOpenMenuId(null)
      showToast(`${member.name} is now an admin`)
    } catch (error) {
      console.error('Error updating role:', error)
      showToast('Failed to update role')
    }
  }

  // DATABASE INTEGRATION: Remove admin privileges
  const handleRemoveAdmin = async (member: BandMember) => {
    try {
      await updateRole(member.membershipId, 'member')

      // Update local state
      const updatedMembers = members.map(m =>
        m.userId === member.userId ? { ...m, role: 'member' as const } : m
      )
      setMembers(updatedMembers)

      setOpenMenuId(null)
      showToast(`${member.name} is now a member`)
    } catch (error) {
      console.error('Error updating role:', error)
      showToast('Failed to update role')
    }
  }

  // DATABASE INTEGRATION: Transfer ownership
  const handleTransferOwnership = async () => {
    if (!selectedMember || transferConfirmText !== 'TRANSFER') return

    try {
      // Find current owner membership
      const currentOwnerMember = members.find(m => m.userId === currentUserId)
      if (!currentOwnerMember) return

      // Update new owner
      await updateRole(selectedMember.membershipId, 'owner')

      // Update old owner to admin
      await updateRole(currentOwnerMember.membershipId, 'admin')

      // Update local state
      const updatedMembers = members.map(m => {
        if (m.userId === selectedMember.userId)
          return { ...m, role: 'owner' as const }
        if (m.userId === currentUserId) return { ...m, role: 'admin' as const }
        return m
      })
      setMembers(updatedMembers)
      setCurrentUserRole('admin')

      setShowTransferOwnershipDialog(false)
      setTransferConfirmText('')
      setSelectedMember(null)
      showToast('Ownership transferred successfully')
    } catch (error) {
      console.error('Error transferring ownership:', error)
      showToast('Failed to transfer ownership')
    }
  }

  const handleToggleInstrument = (instrumentName: string) => {
    const exists = editInstruments.find(inst => inst.name === instrumentName)
    if (exists) {
      // Remove instrument
      setEditInstruments(
        editInstruments.filter(inst => inst.name !== instrumentName)
      )
    } else {
      // Add instrument
      setEditInstruments([
        ...editInstruments,
        { name: instrumentName, isPrimary: false },
      ])
    }
  }

  const handleTogglePrimary = (instrumentName: string) => {
    setEditInstruments(
      editInstruments.map(inst =>
        inst.name === instrumentName
          ? { ...inst, isPrimary: true }
          : { ...inst, isPrimary: false }
      )
    )
  }

  const handleAddCustomInstrument = () => {
    if (customInstrumentName.trim()) {
      const newInstrument = {
        name: customInstrumentName.trim(),
        isPrimary: false,
      }
      setEditInstruments([...editInstruments, newInstrument])
      setShowCustomInstrumentInput(false)
      setCustomInstrumentName('')
    }
  }

  const handleCancelCustomInstrument = () => {
    setShowCustomInstrumentInput(false)
    setCustomInstrumentName('')
  }

  const openEditInstruments = (member: BandMember) => {
    setSelectedMember(member)
    setEditInstruments([...member.instruments])
    setShowEditInstrumentsModal(true)
    setOpenMenuId(null)
  }

  const openMemberDetail = (member: BandMember) => {
    setSelectedMember(member)
    setShowMemberDetailModal(true)
  }

  const openRemoveMember = (member: BandMember) => {
    setSelectedMember(member)
    setShowRemoveMemberDialog(true)
    setOpenMenuId(null)
  }

  const openTransferOwnership = (member: BandMember) => {
    setSelectedMember(member)
    setShowTransferOwnershipDialog(true)
    setOpenMenuId(null)
  }

  // DATABASE INTEGRATION: Permission checks using current user role
  const canEditBand = currentUserRole === 'owner' || currentUserRole === 'admin'
  const canInviteMembers =
    currentUserRole === 'owner' || currentUserRole === 'admin'
  const canRemoveMember = (member: BandMember) => {
    if (member.userId === currentUserId) return false
    if (member.role === 'owner') return false
    if (currentUserRole === 'owner') return true
    if (currentUserRole === 'admin' && member.role !== 'admin') return true
    return false
  }

  // DATABASE INTEGRATION: Show loading state
  if (bandLoading || membersLoading) {
    return (
      <ModernLayout
        bandName="Loading..."
        userEmail={currentUser?.email || 'Not logged in'}
        onSignOut={handleSignOut}
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-white text-lg">Loading band members...</div>
        </div>
      </ModernLayout>
    )
  }

  // DATABASE INTEGRATION: Handle missing band
  if (!band) {
    return (
      <ModernLayout
        bandName="Not Found"
        userEmail={currentUser?.email || 'Not logged in'}
        onSignOut={handleSignOut}
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-white text-lg">Band not found</div>
        </div>
      </ModernLayout>
    )
  }

  // Get active invite code
  const activeInviteCode = inviteCodes[0]?.code || 'No active code'
  const memberCount = members.length

  const getRoleBadge = (role: 'owner' | 'admin' | 'member') => {
    switch (role) {
      case 'owner':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#f17827]/20 text-[#f17827] text-xs font-semibold">
            <Crown size={12} />
            Owner
          </span>
        )
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-semibold">
            <Shield size={12} />
            Admin
          </span>
        )
      case 'member':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#707070]/20 text-[#a0a0a0] text-xs font-semibold">
            <User size={12} />
            Member
          </span>
        )
    }
  }

  return (
    <ModernLayout
      bandName={band.name}
      userEmail={currentUser?.email || 'Not logged in'}
      onSignOut={handleSignOut}
    >
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => window.history.back()}
              className="p-2 rounded-lg border border-[#2a2a2a] bg-transparent text-white hover:bg-[#1f1f1f] transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-3xl font-bold text-white">{band.name}</h1>
          </div>

          {canEditBand && (
            <button
              onClick={() => {
                setEditBandName(band.name)
                setEditBandDescription(band.description || '')
                setShowEditBandModal(true)
              }}
              data-testid="edit-band-info-button"
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#2a2a2a] bg-transparent text-white text-sm font-medium hover:bg-[#1f1f1f] transition-colors"
            >
              <Edit size={16} />
              <span>Edit Band Info</span>
            </button>
          )}
        </div>

        {/* Band Info Card */}
        <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#2a2a2a] mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-[#707070] text-xs uppercase tracking-wider mb-1">
                Members
              </div>
              <div className="text-white text-lg font-semibold">
                {memberCount}
              </div>
            </div>
            <div>
              <div className="text-[#707070] text-xs uppercase tracking-wider mb-1">
                Created
              </div>
              <div className="text-white text-lg font-semibold">
                {band.createdDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
            </div>
            {band.description && (
              <div className="md:col-span-1">
                <div className="text-[#707070] text-xs uppercase tracking-wider mb-1">
                  Description
                </div>
                <div className="text-white text-sm">{band.description}</div>
              </div>
            )}
          </div>
        </div>

        {/* Invite Code Section (Admin/Owner Only) */}
        {canInviteMembers && (
          <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#2a2a2a] mb-6">
            <h2 className="text-white font-semibold mb-4">Invite Members</h2>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <div className="text-[#707070] text-xs uppercase tracking-wider mb-2">
                  Invite Code
                </div>
                <div
                  className="text-white text-2xl font-mono font-bold"
                  data-testid="invite-code"
                  id="band-invite-code"
                >
                  {activeInviteCode}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCopyInviteCode}
                  data-testid="copy-invite-code-button"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f17827] text-white text-sm font-medium hover:bg-[#d96820] transition-colors"
                >
                  <Copy size={16} />
                  <span>{copiedCode ? 'Copied!' : 'Copy'}</span>
                </button>
                {typeof navigator !== 'undefined' && 'share' in navigator && (
                  <button
                    onClick={handleShareInviteCode}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#2a2a2a] bg-transparent text-white text-sm font-medium hover:bg-[#1f1f1f] transition-colors"
                  >
                    <Share2 size={16} />
                    <span>Share</span>
                  </button>
                )}
                <button
                  onClick={() => setShowRegenerateCodeDialog(true)}
                  data-testid="regenerate-invite-code-button"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#2a2a2a] bg-transparent text-[#a0a0a0] text-sm font-medium hover:bg-[#1f1f1f] hover:text-white transition-colors"
                >
                  <RefreshCw size={16} />
                  <span>Regenerate</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative mb-6">
          <Search
            size={20}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#707070]"
          />
          <input
            type="text"
            name="memberSearch"
            id="member-search-input"
            data-testid="member-search-input"
            placeholder="Search members..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-11 pr-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-[#707070] focus:border-[#f17827] focus:outline-none focus:ring-2 focus:ring-[#f17827]/20"
          />
        </div>
      </div>

      {/* Members List - Desktop Table */}
      <div className="hidden md:block">
        <div className="flex items-center gap-4 px-4 pb-3 mb-2 border-b border-[#2a2a2a]">
          <div className="flex-1 min-w-[200px] text-xs font-semibold text-[#707070] uppercase tracking-wider">
            Member
          </div>
          <div className="w-[140px] text-xs font-semibold text-[#707070] uppercase tracking-wider">
            Role
          </div>
          <div className="w-[220px] text-xs font-semibold text-[#707070] uppercase tracking-wider">
            Instruments
          </div>
          <div className="w-[120px] text-xs font-semibold text-[#707070] uppercase tracking-wider">
            Joined
          </div>
          <div className="w-[60px]"></div>
        </div>

        <div className="space-y-2">
          {sortedMembers.map(member => (
            <div
              key={member.userId}
              data-testid={`member-row-${member.email}`}
              className="flex items-center gap-4 p-4 bg-[#1a1a1a] rounded-xl hover:bg-[#252525] transition-colors"
            >
              {/* Member Info */}
              <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm uppercase"
                  style={{ backgroundColor: member.avatarColor }}
                >
                  {member.initials}
                </div>
                <div className="flex-1">
                  <div
                    className="text-white font-semibold text-sm cursor-pointer hover:text-[#f17827] transition-colors"
                    onClick={() => openMemberDetail(member)}
                  >
                    {member.name}
                  </div>
                  <div className="text-[#a0a0a0] text-xs">{member.email}</div>
                </div>
              </div>

              {/* Role */}
              <div className="w-[140px]" data-testid="member-role">
                {getRoleBadge(member.role)}
              </div>

              {/* Instruments */}
              <div className="w-[220px]">
                <div className="flex flex-wrap gap-1">
                  {member.instruments.slice(0, 2).map((inst, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#2a2a2a] text-[#a0a0a0] text-xs"
                    >
                      {inst.isPrimary && (
                        <span className="text-[#f17827]">★</span>
                      )}
                      {inst.name}
                    </span>
                  ))}
                  {member.instruments.length > 2 && (
                    <span className="px-2 py-1 text-[#707070] text-xs">
                      +{member.instruments.length - 2}
                    </span>
                  )}
                </div>
              </div>

              {/* Joined Date */}
              <div className="w-[120px] text-[#a0a0a0] text-sm">
                {member.joinedDate.toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                })}
              </div>

              {/* Actions Menu */}
              <div className="w-[60px] flex justify-end relative">
                {canRemoveMember(member) ||
                currentUserRole === 'owner' ||
                member.userId === currentUserId ? (
                  <>
                    <button
                      onClick={() =>
                        setOpenMenuId(
                          openMenuId === member.userId ? null : member.userId
                        )
                      }
                      className="p-2 rounded-lg text-[#a0a0a0] hover:bg-[#2a2a2a] hover:text-white transition-colors"
                    >
                      <MoreVertical size={16} />
                    </button>

                    {openMenuId === member.userId && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setOpenMenuId(null)}
                        />
                        <div className="absolute right-0 top-full mt-1 w-48 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl z-50 py-1">
                          <button
                            onClick={() => openEditInstruments(member)}
                            className="w-full px-4 py-2 text-left text-white text-sm hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
                          >
                            <Music2 size={16} />
                            Edit Instruments
                          </button>

                          {currentUserRole === 'owner' &&
                            member.role === 'member' && (
                              <button
                                onClick={() => handleMakeAdmin(member)}
                                className="w-full px-4 py-2 text-left text-white text-sm hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
                              >
                                <UserPlus size={16} />
                                Make Admin
                              </button>
                            )}

                          {currentUserRole === 'owner' &&
                            member.role === 'admin' && (
                              <button
                                onClick={() => handleRemoveAdmin(member)}
                                className="w-full px-4 py-2 text-left text-white text-sm hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
                              >
                                <UserMinus size={16} />
                                Remove Admin
                              </button>
                            )}

                          {currentUserRole === 'owner' &&
                            member.role !== 'owner' && (
                              <button
                                onClick={() => openTransferOwnership(member)}
                                className="w-full px-4 py-2 text-left text-white text-sm hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
                              >
                                <Crown size={16} />
                                Transfer Ownership
                              </button>
                            )}

                          {canRemoveMember(member) && (
                            <>
                              <div className="border-t border-[#2a2a2a] my-1" />
                              <button
                                onClick={() => openRemoveMember(member)}
                                className="w-full px-4 py-2 text-left text-red-400 text-sm hover:bg-[#2a2a2a] transition-colors flex items-center gap-2"
                              >
                                <Trash2 size={16} />
                                Remove from Band
                              </button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Members List - Mobile Cards */}
      <div className="md:hidden space-y-3">
        {sortedMembers.map(member => (
          <div
            key={member.userId}
            data-testid={`member-row-${member.email}`}
            className="bg-[#1a1a1a] rounded-xl p-4 border border-[#2a2a2a]"
          >
            <div className="flex items-start gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm uppercase flex-shrink-0"
                style={{ backgroundColor: member.avatarColor }}
              >
                {member.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="text-white font-semibold text-sm cursor-pointer hover:text-[#f17827] transition-colors"
                  onClick={() => openMemberDetail(member)}
                >
                  {member.name}
                </div>
                <div className="text-[#a0a0a0] text-xs truncate">
                  {member.email}
                </div>
                <div className="mt-2">{getRoleBadge(member.role)}</div>
              </div>
              {(canRemoveMember(member) ||
                currentUserRole === 'owner' ||
                member.userId === currentUserId) && (
                <button
                  onClick={() =>
                    setOpenMenuId(
                      openMenuId === member.userId ? null : member.userId
                    )
                  }
                  className="p-2 rounded-lg text-[#a0a0a0] hover:bg-[#2a2a2a] hover:text-white transition-colors flex-shrink-0"
                >
                  <MoreVertical size={16} />
                </button>
              )}
            </div>

            <div className="space-y-2">
              <div>
                <div className="text-[#707070] text-xs mb-1">Instruments</div>
                <div className="flex flex-wrap gap-1">
                  {member.instruments.map((inst, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#2a2a2a] text-[#a0a0a0] text-xs"
                    >
                      {inst.isPrimary && (
                        <span className="text-[#f17827]">★</span>
                      )}
                      {inst.name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#2a2a2a]">
                <span className="text-[#707070] text-xs">Joined</span>
                <span className="text-[#a0a0a0] text-xs">
                  {member.joinedDate.toLocaleDateString('en-US', {
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Band Info Modal */}
      {showEditBandModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-[#2a2a2a]">
              <h2 className="text-white text-xl font-semibold">
                Edit Band Info
              </h2>
              <button
                onClick={() => setShowEditBandModal(false)}
                className="p-2 rounded-lg text-[#a0a0a0] hover:bg-[#2a2a2a] hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Band Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  name="bandName"
                  id="edit-band-name"
                  data-testid="edit-band-name-input"
                  value={editBandName}
                  onChange={e => setEditBandName(e.target.value)}
                  className="w-full px-4 py-2 bg-[#121212] border border-[#2a2a2a] rounded-lg text-white text-sm focus:border-[#f17827] focus:outline-none focus:ring-2 focus:ring-[#f17827]/20"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Description
                </label>
                <textarea
                  name="bandDescription"
                  id="edit-band-description"
                  data-testid="edit-band-description-input"
                  value={editBandDescription}
                  onChange={e => setEditBandDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 bg-[#121212] border border-[#2a2a2a] rounded-lg text-white text-sm focus:border-[#f17827] focus:outline-none focus:ring-2 focus:ring-[#f17827]/20 resize-none"
                  placeholder="Tell us about your band..."
                />
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-[#2a2a2a]">
              <button
                onClick={() => setShowEditBandModal(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-[#2a2a2a] bg-transparent text-white text-sm font-medium hover:bg-[#1f1f1f] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveBandInfo}
                data-testid="save-band-info-button"
                disabled={!editBandName.trim()}
                className="flex-1 px-4 py-2 rounded-lg bg-[#f17827] text-white text-sm font-medium hover:bg-[#d96820] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Regenerate Code Dialog */}
      {showRegenerateCodeDialog && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] w-full max-w-md p-6">
            <h2 className="text-white text-xl font-semibold mb-4">
              Regenerate Invite Code?
            </h2>
            <p className="text-[#a0a0a0] text-sm mb-6">
              The old code will no longer work. Anyone with the current code
              will need the new one to join.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowRegenerateCodeDialog(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-[#2a2a2a] bg-transparent text-white text-sm font-medium hover:bg-[#1f1f1f] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRegenerateCode}
                className="flex-1 px-4 py-2 rounded-lg bg-[#f17827] text-white text-sm font-medium hover:bg-[#d96820] transition-colors"
              >
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member Detail Modal */}
      {showMemberDetailModal && selectedMember && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-[#2a2a2a]">
              <h2 className="text-white text-xl font-semibold">
                Member Details
              </h2>
              <button
                onClick={() => setShowMemberDetailModal(false)}
                className="p-2 rounded-lg text-[#a0a0a0] hover:bg-[#2a2a2a] hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-white font-semibold text-xl uppercase"
                  style={{ backgroundColor: selectedMember.avatarColor }}
                >
                  {selectedMember.initials}
                </div>
                <div>
                  <div className="text-white text-xl font-semibold">
                    {selectedMember.name}
                  </div>
                  <div className="text-[#a0a0a0] text-sm">
                    {selectedMember.email}
                  </div>
                  <div className="mt-2">
                    {getRoleBadge(selectedMember.role)}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-white font-medium mb-3">Instruments</div>
                <div className="flex flex-wrap gap-2">
                  {selectedMember.instruments.map((inst, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-[#2a2a2a] text-white text-sm"
                    >
                      {inst.isPrimary && (
                        <span className="text-[#f17827]">★</span>
                      )}
                      {inst.name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[#707070] text-xs uppercase tracking-wider mb-1">
                    Joined
                  </div>
                  <div className="text-white text-sm">
                    {selectedMember.joinedDate.toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-[#707070] text-xs uppercase tracking-wider mb-1">
                    Status
                  </div>
                  <div className="text-white text-sm capitalize">
                    {selectedMember.status}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-[#2a2a2a]">
              {(canEditBand || selectedMember.userId === currentUserId) && (
                <button
                  onClick={() => {
                    setShowMemberDetailModal(false)
                    openEditInstruments(selectedMember)
                  }}
                  className="flex-1 px-4 py-2 rounded-lg bg-[#f17827] text-white text-sm font-medium hover:bg-[#d96820] transition-colors"
                >
                  Edit Instruments
                </button>
              )}
              <button
                onClick={() => setShowMemberDetailModal(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-[#2a2a2a] bg-transparent text-white text-sm font-medium hover:bg-[#1f1f1f] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Instruments Modal */}
      {showEditInstrumentsModal && selectedMember && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-[#2a2a2a] flex-shrink-0">
              <h2 className="text-white text-xl font-semibold">
                Edit Instruments
              </h2>
              <button
                onClick={() => {
                  setShowEditInstrumentsModal(false)
                  setShowCustomInstrumentInput(false)
                  setCustomInstrumentName('')
                }}
                className="p-2 rounded-lg text-[#a0a0a0] hover:bg-[#2a2a2a] hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar-thin flex-1">
              <div className="text-[#a0a0a0] text-sm">
                Select instruments for{' '}
                <span className="text-white font-medium">
                  {selectedMember.name}
                </span>
              </div>

              {/* Instrument Selection Buttons */}
              <div>
                <div className="text-white font-medium mb-3">
                  Available Instruments
                </div>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                  {instrumentPresets.map(preset => {
                    const isSelected = editInstruments.some(
                      inst => inst.name === preset
                    )
                    return (
                      <button
                        key={preset}
                        onClick={() => handleToggleInstrument(preset)}
                        className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                          isSelected
                            ? 'bg-[#f17827] text-white'
                            : 'bg-[#2a2a2a] text-[#a0a0a0] hover:bg-[#353535] hover:text-white'
                        }`}
                      >
                        {preset}
                      </button>
                    )
                  })}

                  {/* Custom Instrument Button */}
                  <button
                    onClick={() => setShowCustomInstrumentInput(true)}
                    className="px-4 py-3 rounded-lg border-2 border-dashed border-[#2a2a2a] text-[#a0a0a0] text-sm font-medium hover:border-[#f17827] hover:text-[#f17827] transition-colors"
                  >
                    + Custom
                  </button>
                </div>

                {/* Custom Instrument Input */}
                {showCustomInstrumentInput && (
                  <div className="mt-4 p-4 bg-[#121212] rounded-lg border border-[#2a2a2a]">
                    <label className="block text-white text-sm font-medium mb-2">
                      Custom Instrument Name
                    </label>
                    <input
                      type="text"
                      value={customInstrumentName}
                      onChange={e => setCustomInstrumentName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          handleAddCustomInstrument()
                        } else if (e.key === 'Escape') {
                          handleCancelCustomInstrument()
                        }
                      }}
                      placeholder="Enter instrument name..."
                      className="w-full px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm focus:border-[#f17827] focus:outline-none focus:ring-2 focus:ring-[#f17827]/20 mb-3"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddCustomInstrument}
                        className="flex-1 px-4 py-2 rounded-lg bg-[#f17827] text-white text-sm font-medium hover:bg-[#d96820] transition-colors"
                      >
                        Add Instrument
                      </button>
                      <button
                        onClick={handleCancelCustomInstrument}
                        className="flex-1 px-4 py-2 rounded-lg border border-[#2a2a2a] bg-transparent text-white text-sm font-medium hover:bg-[#1f1f1f] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Selected Instruments List */}
              {editInstruments.length > 0 && (
                <div>
                  <div className="text-white font-medium mb-3">
                    Selected Instruments ({editInstruments.length})
                  </div>
                  <div className="space-y-2">
                    {editInstruments.map((inst, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-[#121212] rounded-lg border border-[#2a2a2a]"
                      >
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleTogglePrimary(inst.name)}
                            className={`p-2 rounded-lg transition-colors ${
                              inst.isPrimary
                                ? 'text-[#f17827] bg-[#f17827]/10'
                                : 'text-[#707070] hover:text-[#f17827] hover:bg-[#f17827]/5'
                            }`}
                            title={
                              inst.isPrimary
                                ? 'Primary instrument'
                                : 'Set as primary'
                            }
                          >
                            <span className="text-lg">★</span>
                          </button>
                          <span className="text-white font-medium">
                            {inst.name}
                          </span>
                          {inst.isPrimary && (
                            <span className="px-2 py-1 rounded-md bg-[#f17827]/20 text-[#f17827] text-xs font-medium">
                              Primary
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleToggleInstrument(inst.name)}
                          className="p-2 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors"
                          title="Remove instrument"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-[#707070] text-xs mt-3">
                    Click the star icon to set an instrument as primary
                  </p>
                </div>
              )}

              {editInstruments.length === 0 && (
                <div className="text-center py-8 text-[#707070] text-sm">
                  No instruments selected. Click the buttons above to add
                  instruments.
                </div>
              )}
            </div>

            <div className="flex gap-3 p-6 border-t border-[#2a2a2a] flex-shrink-0">
              <button
                onClick={() => {
                  setShowEditInstrumentsModal(false)
                  setShowCustomInstrumentInput(false)
                  setCustomInstrumentName('')
                }}
                className="flex-1 px-4 py-2 rounded-lg border border-[#2a2a2a] bg-transparent text-white text-sm font-medium hover:bg-[#1f1f1f] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveInstruments}
                className="flex-1 px-4 py-2 rounded-lg bg-[#f17827] text-white text-sm font-medium hover:bg-[#d96820] transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Member Dialog */}
      {showRemoveMemberDialog && selectedMember && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-full bg-red-500/10">
                <AlertTriangle size={24} className="text-red-400" />
              </div>
              <h2 className="text-white text-xl font-semibold">
                Remove Member?
              </h2>
            </div>

            <p className="text-[#a0a0a0] text-sm mb-6">
              Remove{' '}
              <span className="text-white font-medium">
                {selectedMember.name}
              </span>{' '}
              from <span className="text-white font-medium">{band.name}</span>?
              They will lose access to all band content.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowRemoveMemberDialog(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-[#2a2a2a] bg-transparent text-white text-sm font-medium hover:bg-[#1f1f1f] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveMember}
                className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Ownership Dialog */}
      {showTransferOwnershipDialog && selectedMember && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-full bg-[#f17827]/10">
                <Crown size={24} className="text-[#f17827]" />
              </div>
              <h2 className="text-white text-xl font-semibold">
                Transfer Ownership
              </h2>
            </div>

            <div className="space-y-4 mb-6">
              <p className="text-[#a0a0a0] text-sm">
                Transfer ownership of{' '}
                <span className="text-white font-medium">{band.name}</span> to{' '}
                <span className="text-white font-medium">
                  {selectedMember.name}
                </span>
                ?
              </p>

              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-yellow-400 text-sm">
                  <strong>Warning:</strong> You will become an admin. This
                  cannot be undone.
                </p>
              </div>

              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Type{' '}
                  <span className="font-mono text-[#f17827]">TRANSFER</span> to
                  confirm
                </label>
                <input
                  type="text"
                  value={transferConfirmText}
                  onChange={e => setTransferConfirmText(e.target.value)}
                  className="w-full px-4 py-2 bg-[#121212] border border-[#2a2a2a] rounded-lg text-white text-sm focus:border-[#f17827] focus:outline-none focus:ring-2 focus:ring-[#f17827]/20"
                  placeholder="TRANSFER"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowTransferOwnershipDialog(false)
                  setTransferConfirmText('')
                }}
                className="flex-1 px-4 py-2 rounded-lg border border-[#2a2a2a] bg-transparent text-white text-sm font-medium hover:bg-[#1f1f1f] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleTransferOwnership}
                disabled={transferConfirmText !== 'TRANSFER'}
                className="flex-1 px-4 py-2 rounded-lg bg-[#f17827] text-white text-sm font-medium hover:bg-[#d96820] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Transfer Ownership
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {sortedMembers.length === 0 && (
        <div className="text-center py-12">
          <div className="text-[#707070] mb-4">No members found</div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-[#f17827] text-sm hover:underline"
            >
              Clear search
            </button>
          )}
        </div>
      )}

      {/* DATABASE INTEGRATION: Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl p-4 z-50 animate-slide-up">
          <p className="text-white text-sm">{toastMessage}</p>
        </div>
      )}

      {/* DATABASE INTEGRATION: Updated info banner */}
      <div className="mt-8 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
        <p className="text-green-400 text-sm">
          <strong>Database Integrated:</strong> This page is now connected to
          the database. All changes are persisted. Current role:{' '}
          {currentUserRole}. Band ID: {currentBandId.substring(0, 8)}...
        </p>
      </div>
    </ModernLayout>
  )
}
