const { gql } = require("graphql-tag");

module.exports = gql`

    """
    An identity in the format:

    hrc:productKey:identifier

    where:
    productKey: Oid
    identifier: Unique ID for the Product

    This is used to identify a Resource between systems and be somewhat parsable
    by the consumer of the data to find shared identifier information.  For example:

    hrc:1.3.6.1.4.1.50624.1.2.2:a136fed7-0cbd-4a20-ae5a-a000df5d441c
    """
    scalar SharedIdentity

    """
    An JSON encoded document intended to represent metadata as it pertains
    to each product using this API.  Top-level keys in the document are defined
    by the Oid value for the Product applying the metadata.
    """
    scalar MetadataSchema

    """The Timestamp scalar type represents a datetime in ISO-8601 UTC format."""
    scalar Timestamp

    """A string that indicates the media type, using the format from the RFC: https://www.rfc-editor.org/rfc/rfc7231#section-3.1.1.1"""
    scalar MediaType

    """The four character, upper case, alphanumeric facility (a.k.a tenant) code."""
    scalar FacilityShortCode

    """The IP Address scalar type constitutes identifiers of each device connected to a computer network that uses Internet Protocol for communication. This scalar type validates IPv4 and IPv6. IPv4 is the 32 bit address scheme. The addresses are separated by period (.). IPv4 addresses are of the range 0.0.0.0 - 255.255.255.255. IPv6 is a 128 bit alphanumeric address separated by colon (:). It can even contain hexadecimal."""
    scalar IPAddress

    """The LanguageCode scalar type constitutes a combination of an ISO 639 two-letter or three-letter lowercase culture code associated with a language and an ISO 3166 two-letter uppercase subculture code associated with a country or region."""
    scalar LanguageCode

    """The Mac Address scalar type constitutes a 6 byte hexadecimal which is separated by colon or a dash."""
    scalar MacAddress

    """The Oid scalar type constitutes an identifier standardized by the International Telecommunication Union (ITU) and ISO/IEC for naming any object, concept, or 'thing' with a globally unambiguous persistent name."""
    scalar Oid

    """
    New format of the chat message allows text based segments, mentions of users in the same
    conversation, or symbols like "ALL"
    """
    union TextMessageElement = ChatMessageTextElement | ChatMessageMentionElement | ChatMessageSymbolElement

    """Level at which a ChannelMember is notified of events on a Channel"""
    enum ChannelNotificationLevel {
        """All notifications should apply"""
        loud
        """Only notifications where the channel member is mentioned"""
        mention
        """All notifications should be deactivated"""
        mute
    }

    enum ChannelMemberSort {
        """The value of the display_name key placed into metadata on a ChannelMember for Oid == 1.3.6.1.4.1.50624.1.2.2"""
        voalteMobileMetadataDisplayName
    }

    enum ChatMessagePriority {
        normal
        urgent
    }

    enum ChatMessageSymbol {
        ALL
    }

    enum ChatMessageStatus {
        """The ChatMessage initial status when created"""
        created
        """This ChatMessage was read by the current member for the channel"""
        read
    }

    type ChatMessageMentionElement {
        member: ChannelMember
        add: Boolean
    }

    type ChatMessageTextElement {
        text: String!
    }

    """
    Ex.
    {
    symbol: 'ALL' - Used when tagging all members from a channel
    }
    """
    type ChatMessageSymbolElement {
        symbol: ChatMessageSymbol!
    }

    type ChannelConnection implements Connection {
        edges: [ChannelConnectionEdge]!
        pageInfo: PageInfo!
    }

    type ChannelConnectionEdge implements ConnectionEdge {
        node: Channel!
        cursor: String
    }

    """
    An aggregation of ChatMessage similar to a conversation had between ChannelMembers
    on a subject.  The view of this type is always from the perspective of the
    ChannelMember which made the request.
    """
    type Channel implements Node {
        id: ID!
        """
        A unique business key per tenant used to locate the Channel when the ID is
        not known.  Helpful when sharing context outside of the API to then share
        usage of the API.  For example, this could be a digest of a various metadata
        values on the Channel for the client or a naming convention using delimiters and known values.
        """
        seed: String!
        """Timestamp of when the Channel was created"""
        createdAt: Timestamp!
        """Last time activity associated with the Channel occurred"""
        lastActivityAt: Timestamp!
        """The viewing ChannelMember's notification level for this Channel; defaults to 'loud'"""
        notificationLevel: ChannelNotificationLevel!
        """
        Channel members available via paging.  If no arguments are specified, then only
        the 1st page using default values will be returned with no predefined sort order.
        """
        members(limit: Int, offset: Int, sortBy: ChannelMemberSort): MemberConnection
        """
        ChatMessages associated with the first page of history from the Channel only.  Helpful when populating initial Channel context.
        No offset-based paging is support as cursor-based is the preferred method using the chats field.
        """
        initialChats(limit: Int): ChatMessageConnection
        """ChatMessages associated with a Channel using cursor-based paging.  Paging may only go forward, not backwards."""
        chats(after: String, first: Int): ChatMessageConnection
        """
        Product specific metadata.  Entered by the Channel creator.  For example, data
        related to the client system that is helpful for search could be added here.
        """
        metadata: MetadataSchema
    }

    type ChatMessageConnection implements Connection {
        edges: [ChatMessageConnectionEdge]!
        pageInfo: PageInfo!
        """Order number of the most recent chat message marked as read. When a new member is added to an existing channel, the first value for this field is set to the highest chat message order in that channel for the new member."""
        lastReadOrder: Int
        """Order number of the most recent chat message not yet marked as read"""
        lastUnreadOrder: Int
        """Count of all ChatMessages in the Channel that are not marked as read"""
        unreadCount: Int
        """A simple flag that represents whether the requesting user is mentioned since the last read chat message"""
        unreadMention: Boolean!
    }

    type MemberConnection implements Connection {
        edges: [MemberConnectionEdge]!
        pageInfo: PageInfo!
    }

    type MemberConnectionEdge implements ConnectionEdge {
        node: ChannelMember!
        cursor: String
    }

    """A User as associated with a Channel."""
    type ChannelMember implements Node {
        id: ID!
        """The identity of the user in the Product being associated with the member"""
        identity: SharedIdentity!
        """Notification level for this member on this channel."""
        notificationLevel: ChannelNotificationLevel!
        """
        Product specific metadata.  Created by the client system using the User.
        Way to store information like name, to allow searching later on.
        """
        metadata: MetadataSchema
    }

    type ChatMessageConnectionEdge implements ConnectionEdge {
        node: ChatMessage!
        """order:<chat_order_num> - Assuming that all consumers can work with order number"""
        cursor: String!
    }

    """Page info is related to application paging to limit the flow of data to the client"""
    type PageInfo {
        """If a next page exists"""
        hasNextPage: Boolean
        """If a previous page exists"""
        hasPreviousPage: Boolean
        """Cursor starting the page for cursor-based paging"""
        startCursor: String
        """Cursor ending the page for cursor-based paging"""
        endCursor: String
        """Number of nodes in the whole dataset"""
        totalCount: Int
        """The offset which was used to generate this page for offset/limit paging"""
        offset: Int
        """The continuation token used to return the next page of results when using continuation token-based paging"""
        continuationToken: String
    }

    """Represents a ChatMessage associated with a Channel.  Should be considered an immutable resource once created."""
    type ChatMessage implements Node {
        """Internal identifier"""
        id: ID!
        """Seed associated with the Channel to which this ChatMessage belongs"""
        channelSeed: String!
        """
        Order number created relative to the Channel to provide an authoritative order for the order in which ChatMessages are created.
        Order number is not guaranteed to be sequential in the same Channel, but its value will always increase over time and relative to other ChatMessages.

        Validation: Positive integer
        """
        order: Int!
        """ChannelMember that sent the ChatMessage"""
        sentBy: ChannelMember!
        createdAt: Timestamp!
        """Optional text associated with the ChatMessage"""
        text: String
        """Structured chat message using complex types"""
        elements: [TextMessageElement!]
        """
        Paging explicitly not used here

        Validation: Max of 10 elements
        """
        attachments: [ChatMessageAttachment]
        priority: ChatMessagePriority!
        status: ChatMessageStatus!
        metadata: MetadataSchema
    }

    """Represents an attachment for a ChatMessage.  Typically this is a URL to a media element."""
    type ChatMessageAttachment {
        """Internal identifier"""
        id: ID!
        """
        Useful for consumers to determine what player to load if the URL is media.

        Validation: Valid MIME type
        """
        contentType: MediaType
        """Link to the attachment asset accessible to the consumers of the ChatMessage to which this is attached"""
        url: String
        metadata: MetadataSchema
    }

    """Relay Connection definition"""
    interface Connection {
        edges: [ConnectionEdge]
        pageInfo: PageInfo
    }

    """Relay Connection Edge definition"""
    interface ConnectionEdge {
        node: Node!
        """Opaque string used to track edges in a page when using cursor-based paging"""
        cursor: String
    }

    """Relay Connection Edge Node definition"""
    interface Node {
        id: ID!
    }

    input RegisterTenantInput {
        credentials: String!
    }

    """Either text, elements or attachments must be provided for the input to be valid."""
    input SendChatInput {
        """The seed used by a Channel with which to associate the new ChatMessage"""
        seed: String!
        text: String
        elements: [SendChatElementInput!]
        attachments: [ChatMessageAttachmentInput]
        priority: ChatMessagePriority!
        metadata: MetadataSchema
    }

    type SendChatPayload {
        message: ChatMessage!
        membersAdded: [SharedIdentity!]
    }

    type CreateChannelPayload {
        channel: Channel!
    }

    """
    Validation:
    Only one of the segments can be defined in the object, it has to be
    either a text, mention or symbol. If multiple are present in the object
    the server will reply with an error message
    """
    input SendChatElementInput {
        text: SendChatElementTextInput
        mention: SendChatElementMentionInput
        symbol: SendChatElementSymbolInput
    }

    input SendChatElementTextInput {
        text: String!
    }

    input SendChatElementMentionInput {
        member: ChannelMemberInput!
        text: String!
        add: Boolean
    }

    input SendChatElementSymbolInput {
        symbol: ChatMessageSymbol!
    }

    input ChatMessageAttachmentInput {
        contentType: MediaType!
        url: String!
        metadata: MetadataSchema
    }

    """Represents the input for the addition of members on a Channel"""
    input ChannelMemberInput {
        """Validation: Must match mask described in scalar definition"""
        identity: SharedIdentity!
        """
        Initial metadata schema associated with the channel

        Validation: Must be a stringified JSON object
        """
        metadata: MetadataSchema
    }

    """Used as input to create a channel"""
    input CreateChannelInput {
        """
        Unique business key to associate with the Channel.  Suggest partitioning the string to be unique
        for your Product and the variations in your Product.  For example, Voalte Mobile Group Messages could
        use iris:group:<uuid> to distinguish its seed.

        Validation: Min of 3 characters
        """
        seed: String!
        """
        List of all User identities to immediately make members of the channel

        Validation: Must be at least of size 1 and not exceed a limit of 2000 member(s)
        """
        members: [ChannelMemberInput!]!
        """
        Initial metadata schema associated with the current user who is the creator of the channel

        Validation: Must be a stringified JSON object
        """
        createdByMetadata: MetadataSchema
        """
        Initial metadata schema associated with the channel

        Validation: Must be a stringified JSON object
        """
        metadata: MetadataSchema
        """
        Enable the automatic creation of subscriptions for all members added to this Channel.  This will assume a standard
        form for the ChannelUpdate type.  Defaults to false.
        """
        autoWatch: Boolean = false
    }

    type Query {
        """Used to test the availability of the chat subgraph."""
        healthChat: Boolean
        """
        Retrieves a list of Channels, for the User making the request, using limit/offset paging.  Sort based on Channel.lastActivityAt
        Defaults to offset=0 and first=20 as arguments if not provided.

        Validation:
        offset - Must be a positive number
        limit - Must be a positive number
        """
        channels(offset: Int, limit: Int): ChannelConnection!

    }

    type Mutation {
        """
        Used internally to setup a tenant and a user for that tenant for use the CSA

        ERRORS:
        FORBIDDEN - If called from an external environment (ex: production), it will fail with this error
        INTERNAL_SERVER_ERROR - If the user creation fails
        """
        registerTenant(input: RegisterTenantInput!): Boolean!

        """
        Creates a Channel given data including a seed and users to make into ChannelMembers.  Please note, a ChannelMemberAddEvent
        is not generated for members added when creating a Channel, even if autowatch is used.

        ERRORS:
        - NOT_UNIQUE - A channel with the provided seed value already exists
        """
        createChannel(input: CreateChannelInput!): CreateChannelPayload!

        """
        Create a ChatMessage and associate it with a Channel

        ERRORS:
        - NOT_FOUND - seed not found
        """
        sendChat(input: SendChatInput!): SendChatPayload!
    }
`;
